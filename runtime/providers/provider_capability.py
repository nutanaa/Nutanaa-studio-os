from __future__ import annotations

from enum import Enum


class ProviderCapability(str, Enum):
    """Capabilities that a provider may advertise."""

    TEXT = "text"
    STREAM = "stream"
    EMBEDDING = "embedding"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TOOL_CALL = "tool_call"
    REASONING = "reasoning"
    UPSCALE = "upscale"
    LIP_SYNC = "lip_sync"
    SPEECH = "speech"
