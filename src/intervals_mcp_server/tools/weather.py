"""
Weather MCP tools for Intervals.icu.

This module contains tools for managing weather configuration and forecasts.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def get_weather_config(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get weather configuration for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/weather-config", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching weather config: {result.get('message')}"

    if not result:
        return f"No weather configuration found for athlete {athlete_id_to_use}."

    return f"Weather Configuration:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def update_weather_config(
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update weather configuration for an athlete on Intervals.icu.

    Args:
        updates: Dictionary of weather config fields to update
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/weather-config",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating weather config: {result.get('message')}"

    if not result:
        return "Weather configuration updated."

    return f"Successfully updated weather config:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_weather_forecast(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get weather forecast for an athlete's location from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/weather-forecast", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching weather forecast: {result.get('message')}"

    if not result:
        return f"No weather forecast available for athlete {athlete_id_to_use}."

    if isinstance(result, dict):
        lines = ["Weather Forecast:", ""]
        for key, val in result.items():
            if val is not None:
                if isinstance(val, (dict, list)):
                    lines.append(f"{key}: {json.dumps(val)}")
                else:
                    lines.append(f"{key}: {val}")
        return "\n".join(lines)

    return f"Weather Forecast:\n\n{json.dumps(result, indent=2)}"
