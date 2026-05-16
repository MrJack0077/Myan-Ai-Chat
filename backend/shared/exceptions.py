"""
Shared: Custom exception classes for the backend.
"""


class AppError(Exception):
    """Base application error."""
    def __init__(self, message: str, code: str = "UNKNOWN", status: int = 500):
        super().__init__(message)
        self.code = code
        self.status = status


class ShopNotFoundError(AppError):
    def __init__(self, acc_id: str):
        super().__init__(f"Shop not found for bot: {acc_id}", "SHOP_NOT_FOUND", 404)


class TokenError(AppError):
    def __init__(self, acc_id: str):
        super().__init__(f"SendPulse token failed for: {acc_id}", "TOKEN_ERROR", 401)


class RateLimitError(AppError):
    def __init__(self, shop_doc_id: str):
        super().__init__(f"Rate limit exceeded: {shop_doc_id}", "RATE_LIMIT", 429)


class AIError(AppError):
    def __init__(self, msg: str = "AI generation failed"):
        super().__init__(msg, "AI_ERROR", 500)


class ValidationError(AppError):
    def __init__(self, field: str, value: str = ""):
        super().__init__(f"Invalid {field}: {value}", "VALIDATION_ERROR", 422)
