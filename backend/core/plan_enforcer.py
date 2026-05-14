"""
Subscription Plan Enforcer — checks limits before AI processing.
Basic: 500 subs, 1 channel, 5M tokens/month
Premium: 1000 subs, 3 channels, 10M tokens/month
Enterprise: Custom
"""
from datetime import datetime, timezone


DEFAULT_PLANS = {
    "basic": {
        "subscriber_limit": 500,
        "channel_limit": 1,
        "token_limit": 5_000_000,
    },
    "premium": {
        "subscriber_limit": 1000,
        "channel_limit": 3,
        "token_limit": 10_000_000,
    },
    "enterprise": {
        "subscriber_limit": 999999,
        "channel_limit": 999,
        "token_limit": 999_999_999,
    },
}

LIMIT_MESSAGES_MM = {
    "subscribers": "ဝန်ဆောင်မှုယူထားတဲ့ subscriber အရေအတွက် ပြည့်သွားပါပြီ။ Plan upgrade လုပ်ဖို့ admin ကိုဆက်သွယ်ပါ။",
    "tokens": "ယခုလအတွက် AI အသုံးပြုမှု ပမာဏ ကုန်သွားပါပြီ။ နောက်လအထိ စောင့်ပါ သို့မဟုတ် plan upgrade လုပ်ပါ။",
    "channels": "ဒီ channel အတွက် ဝန်ဆောင်မှု မရသေးပါ။ Plan upgrade လုပ်ပါ။",
}

LIMIT_MESSAGES_EN = {
    "subscribers": "Subscriber limit reached. Please contact admin to upgrade your plan.",
    "tokens": "Monthly AI token limit reached. Please wait until next month or upgrade your plan.",
    "channels": "This channel is not available on your current plan. Please upgrade.",
}


def get_plan(shop_data: dict) -> dict:
    """Get plan config for a shop, with defaults."""
    plan_name = shop_data.get("plan", "basic")
    plan = dict(DEFAULT_PLANS.get(plan_name, DEFAULT_PLANS["basic"]))
    # Allow custom overrides from shop data
    if shop_data.get("subscriber_limit"):
        plan["subscriber_limit"] = shop_data["subscriber_limit"]
    if shop_data.get("channel_limit"):
        plan["channel_limit"] = shop_data["channel_limit"]
    if shop_data.get("token_limit"):
        plan["token_limit"] = shop_data["token_limit"]
    plan["name"] = plan_name
    return plan


def check_token_reset(shop_data: dict) -> dict:
    """Reset tokens if new month started. Returns shop_data (modified in place)."""
    now = datetime.now(timezone.utc)
    reset_date_str = shop_data.get("token_reset_date")
    
    if reset_date_str:
        try:
            reset_date = datetime.fromisoformat(reset_date_str)
            if now > reset_date:
                shop_data["tokens_used"] = 0
                # Set next reset to same day next month
                from dateutil.relativedelta import relativedelta
                shop_data["token_reset_date"] = (reset_date + relativedelta(months=1)).isoformat()
        except (ValueError, ImportError):
            pass
    
    if not shop_data.get("token_reset_date"):
        # First time — reset at end of current month
        from dateutil.relativedelta import relativedelta
        next_month = now.replace(day=1) + relativedelta(months=1)
        shop_data["token_reset_date"] = next_month.isoformat()
        shop_data["tokens_used"] = 0
    
    return shop_data


def check_limits(shop_data: dict, subscriber_count: int, channel_count: int, current_tokens: int, lang: str = "my") -> tuple:
    """
    Check all plan limits. Returns (allowed: bool, message: str, limit_type: str).
    """
    plan = get_plan(shop_data)
    msgs = LIMIT_MESSAGES_MM if lang in ["myanmar", "burmese", "mm"] else LIMIT_MESSAGES_EN
    
    # Token reset if needed
    shop_data = check_token_reset(shop_data)
    tokens_used = shop_data.get("tokens_used", 0)
    
    # Check subscriber limit
    if subscriber_count > plan["subscriber_limit"]:
        return False, msgs["subscribers"], "subscribers", plan
    
    # Check channel limit
    if channel_count > plan["channel_limit"]:
        return False, msgs["channels"], "channels", plan
    
    # Check token limit
    if tokens_used + current_tokens > plan["token_limit"]:
        # Warning at 80%
        if tokens_used >= plan["token_limit"] * 0.8:
            pass  # Still allow but log warning
        if tokens_used >= plan["token_limit"]:
            return False, msgs["tokens"], "tokens", plan
    
    return True, "", "", plan


async def send_limit_alert(db, shop_doc_id: str, limit_type: str, plan: dict, lang: str = "my"):
    """Send admin notification when limit reached."""
    try:
        alerts = LIMIT_MESSAGES_MM if lang in ["myanmar", "burmese", "mm"] else LIMIT_MESSAGES_EN
        message = alerts.get(limit_type, f"Plan limit reached: {limit_type}")
        
        notif_ref = db.collection("shops").document(shop_doc_id).collection("notifications").document()
        notif_ref.set({
            "type": "plan_limit_alert",
            "title": f"⚠️ Plan Limit: {limit_type}",
            "body": message,
            "limit_type": limit_type,
            "shop_id": shop_doc_id,
            "plan_name": plan.get("name", "basic"),
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"⚠️ Alert error: {e}", flush=True)
