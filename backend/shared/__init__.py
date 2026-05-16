"""
Shared utilities package — no business logic, only thin wrappers.
"""
from .redis import cache_set, cache_get, cache_delete, cache_exists, check_rate_limit
from .firestore import (
    handle_firestore_error, firestore_get, firestore_set, firestore_update, firestore_add,
)
from .http_client import (
    verify_sendpulse_signature, robust_api_post, bg_post, get_sendpulse_token,
)
from .exceptions import (
    AppError, ShopNotFoundError, TokenError, RateLimitError, AIError, ValidationError,
)
