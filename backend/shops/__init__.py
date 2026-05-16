"""
Shops module — shop data, automation settings, analytics.
"""
from .service import get_shop_data, get_shop_automation, list_shops
from .automation import update_automation, get_automation
from .analytics import increment_tokens, log_analytics
