"""
config.py -- Application settings for Daily Vanishing News.

Loads all configuration from environment variables (or a .env file)
using pydantic-settings BaseSettings. Every downstream module should
import `settings` from here instead of reading os.environ directly.
"""

from __future__ import annotations

import json
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration object.

    All fields map 1-to-1 with environment variables of the same name
    (case-insensitive). Optional fields have sensible defaults so the
    app can start without every external service being configured.
    """

    # ------------------------------------------------------------------ #
    # MongoDB
    # ------------------------------------------------------------------ #
    MONGODB_URL: str
    """Full MongoDB connection string (Atlas or local)."""

    MONGODB_DB_NAME: str = "daily_vanish_news"
    """Database name inside the MongoDB cluster."""

    # ------------------------------------------------------------------ #
    # Redis / Upstash
    # ------------------------------------------------------------------ #
    REDIS_URL: str
    """Redis connection URL. Upstash uses rediss:// (TLS)."""

    # ------------------------------------------------------------------ #
    # Third-party APIs (all optional)
    # ------------------------------------------------------------------ #
    NEWSAPI_KEY: str = ""
    """NewsAPI.org API key. Leave blank to skip NewsAPI fetching."""

    OPENAI_API_KEY: str = ""
    """OpenAI API key for Tier-3 LLM verification. Leave blank to skip."""

    ONESIGNAL_APP_ID: str = ""
    """OneSignal application ID for push notifications."""

    ONESIGNAL_API_KEY: str = ""
    """OneSignal REST API key for push notifications."""

    # ------------------------------------------------------------------ #
    # TTL / visibility rules
    # ------------------------------------------------------------------ #
    TTL_HOURS: int = 24
    """Hours after publication before an article expires (MongoDB TTL)."""

    MIN_VISIBILITY_HOURS: int = 2
    """Minimum hours a breaking article must remain visible."""

    # ------------------------------------------------------------------ #
    # CORS
    # ------------------------------------------------------------------ #
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    """List of allowed CORS origins. Can be set as a JSON array string."""

    # ------------------------------------------------------------------ #
    # App meta
    # ------------------------------------------------------------------ #
    DEBUG: bool = False
    """Enable debug logging and FastAPI debug mode."""

    ENVIRONMENT: str = "development"
    """Runtime environment: 'development' | 'staging' | 'production'."""

    # ------------------------------------------------------------------ #
    # Pydantic-settings config
    # ------------------------------------------------------------------ #
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Validators
    # ------------------------------------------------------------------ #
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: object) -> List[str]:
        """Allow ALLOWED_ORIGINS to be supplied as a JSON array string.

        This makes it easy to pass the value through a single environment
        variable, e.g.::

            ALLOWED_ORIGINS='["https://app.example.com"]'
        """
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                # Treat as a single origin
                return [v.strip()]
        return v  # type: ignore[return-value]


# Singleton instance used throughout the application.
settings = Settings()  # type: ignore[call-arg]
