"""
Webhook: Pydantic schemas for SendPulse webhook payload validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any


class MessageEvent(BaseModel):
    """A single message event from SendPulse webhook."""
    type: str = Field(default="message", description="Event type: message, delivery, read")
    text: Optional[str] = Field(default=None, description="Message text content")
    contact_id: Optional[str] = Field(default=None)
    contact: Optional[dict[str, Any]] = Field(default=None)
    bot_id: Optional[str] = Field(default=None)
    channel: Optional[str] = Field(default="")
    attachments: Optional[list[dict[str, Any]]] = Field(default=None)
    payload: Optional[dict[str, Any]] = Field(default=None)
    extra: Optional[dict[str, Any]] = Field(default=None)


class WebhookPayload(BaseModel):
    """Top-level webhook payload from SendPulse (can be single or batch)."""
    data: Optional[MessageEvent] = Field(default=None, description="Single event")
    batch: Optional[list[MessageEvent]] = Field(default=None, description="Batch events")
    type: Optional[str] = Field(default=None, description="Payload type")
    bot_id: Optional[str] = Field(default=None)
    # Raw fields for fallback access
    raw: Optional[dict[str, Any]] = Field(default=None, description="Original raw payload")
