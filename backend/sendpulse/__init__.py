"""
SendPulse API Client — fully isolated module.
All external SendPulse HTTP calls go through this package.
"""
from .auth import get_token
from .client import call_with_fallback, fire_and_forget
from .messages import send_message
from .actions import send_typing, send_stop_typing, open_chat, add_tag
