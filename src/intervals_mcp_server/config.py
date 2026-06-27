"""
Configuration management for Intervals.icu MCP Server.

This module handles loading and validation of configuration from environment variables.
"""

import os
from dataclasses import dataclass

from intervals_mcp_server.utils.validation import validate_athlete_id

# Try to load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv

    _ = load_dotenv()
except ImportError:
    # python-dotenv not installed, proceed without it
    pass


@dataclass
class Config:
    """Configuration settings for the Intervals.icu MCP Server."""

    api_key: str
    athlete_id: str
    intervals_api_base_url: str
    user_agent: str
    trainerroad_username: str
    trainerroad_password: str
    trainerroad_cookie: str
    trainerroad_member_id: str
    supabase_url: str
    supabase_service_role_key: str
    second_brain_mcp_url: str
    directeur_url: str
    directeur_api_key: str
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    web_api_token: str = ""
    web_allowed_origin: str = "*"


_config_instance: Config | None = None  # pylint: disable=invalid-name


def load_config() -> Config:
    """
    Load configuration from environment variables.

    Returns:
        Config: Configuration instance with loaded values.

    Raises:
        ValueError: If athlete_id is invalid (when non-empty).
    """
    api_key = os.getenv("API_KEY", "")
    athlete_id = os.getenv("ATHLETE_ID", "")
    intervals_api_base_url = os.getenv("INTERVALS_API_BASE_URL", "https://intervals.icu/api/v1")
    user_agent = "intervalsicu-mcp-server/1.0"
    trainerroad_username = os.getenv("TRAINERROAD_USERNAME", "")
    trainerroad_password = os.getenv("TRAINERROAD_PASSWORD", "")
    trainerroad_cookie = os.getenv("TRAINERROAD_COOKIE", "")
    trainerroad_member_id = os.getenv("TRAINERROAD_MEMBER_ID", "")
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    second_brain_mcp_url = os.getenv("SECOND_BRAIN_MCP_URL", "")
    directeur_url = os.getenv("DIRECTEUR_URL", "")
    directeur_api_key = os.getenv("DIRECTEUR_API_KEY", "")
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    deepseek_model = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
    web_api_token = os.getenv("WEB_API_TOKEN", "")
    web_allowed_origin = os.getenv("WEB_ALLOWED_ORIGIN", "*")

    # Validate athlete_id if provided (empty string is allowed)
    if athlete_id:
        validate_athlete_id(athlete_id)

    return Config(
        api_key=api_key,
        athlete_id=athlete_id,
        intervals_api_base_url=intervals_api_base_url,
        user_agent=user_agent,
        trainerroad_username=trainerroad_username,
        trainerroad_password=trainerroad_password,
        trainerroad_cookie=trainerroad_cookie,
        trainerroad_member_id=trainerroad_member_id,
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
        second_brain_mcp_url=second_brain_mcp_url,
        directeur_url=directeur_url,
        directeur_api_key=directeur_api_key,
        deepseek_api_key=deepseek_api_key,
        deepseek_base_url=deepseek_base_url,
        deepseek_model=deepseek_model,
        web_api_token=web_api_token,
        web_allowed_origin=web_allowed_origin,
    )


def get_config() -> Config:
    """
    Get the configuration instance (singleton pattern).

    Returns:
        Config: The configuration instance.
    """
    global _config_instance  # pylint: disable=global-statement  # noqa: PLW0603 - singleton pattern
    if _config_instance is None:
        _config_instance = load_config()
    return _config_instance
