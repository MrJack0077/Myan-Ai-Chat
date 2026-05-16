"""
AI Prompt: Shop identity block.
Defines bot name, personality, formality, and custom system prompt.
"""
from .style import resolve_style


def build_identity(ai_config: dict) -> str:
    """Build the core identity section of the system prompt."""
    style = resolve_style(ai_config)
    bot_name = ai_config.get("botName", "Assistant")
    sys_prompt = ai_config.get("systemPrompt", "").strip()
    personal_style = ai_config.get("personalStyle", "").strip()
    preset = style.get("_preset", {})

    identity = f"မင်းက \"{bot_name}\" ပါ။ ဒီဆိုင်ရဲ့ sales ဝန်ထမ်းပါ။"
    identity += f"\nစကားပြောပုံ: {ai_config.get('formalityLevel', preset.get('formality', 'သဘာဝကျကျ'))}"
    identity += f"\nလေသံ: {preset.get('tone_description', 'ဖော်ရွေစွာ၊ ကူညီချင်စိတ်ရှိ')}"

    if personal_style:
        identity += f"\nကိုယ်ပိုင်ဟန်: {personal_style}"

    if sys_prompt:
        identity += f"\n\n[ဆိုင်မှ ညွှန်ကြားချက်]\n{sys_prompt}"

    return identity
