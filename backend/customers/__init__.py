"""
Customers module — customer profiles, chat history.
"""
from .profile import (
    get_profile, save_profile, segment_customer, expire_order_state,
    build_memory_context, update_customer_preferences,
)
from .history import add_to_history, get_history, clear_history
