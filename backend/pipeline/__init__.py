"""
Pipeline module — message processing pipeline (Chain of Responsibility pattern).
"""
from .orchestrator import process_core_logic
from .stages.extract import extract_payload_data
from .stages.validate import validate_request
from .stages.profile import load_and_update_profile
from .stages.context import build_context
from .stages.research import run_research
from .stages.reason import generate_ai_reply
from .stages.respond import send_reply
from .stages.finalize import finalize_pipeline
