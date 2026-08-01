from __future__ import annotations

from enum import Enum


class ProviderType(str, Enum):
    """Supported provider categories."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OLLAMA = "ollama"
    GROQ = "groq"
    OPENROUTER = "openrouter"
    DEEPSEEK = "deepseek"
    MISTRAL = "mistral"
    AZURE_OPENAI = "azure_openai"
    VERTEX_AI = "vertex_ai"
    AWS_BEDROCK = "aws_bedrock"
    LOCAL = "local"
    MOCK = "mock"
    CUSTOM = "custom"
