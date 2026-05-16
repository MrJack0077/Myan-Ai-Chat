"""
Orders module — order extraction, state machine, persistence, notifications.
"""
from .extractor import extract_order_data, get_order_summary
from .handler import handle_order_confirmation, handle_escalation
from .persistence import save_order, update_inventory
from .notifications import notify_admin_order, notify_handover
