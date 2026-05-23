"""
Weather MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def manage_weather(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage weather configuration and get forecasts on Intervals.icu.

    Args:
        action: One of: config, update_config, forecast
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        data: For update_config: weather config fields to update
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "config":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/weather-config", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No weather configuration found."
        return f"Weather Configuration:\n\n{json.dumps(result, indent=2)}"

    elif action == "update_config":
        if not data:
            return "Error: 'data' required for update_config"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/weather-config", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Updated weather config:\n\n{json.dumps(result, indent=2)}" if result else "Weather configuration updated."

    elif action == "forecast":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/weather-forecast", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No weather forecast available."
        if isinstance(result, dict):
            lines = ["Weather Forecast:", ""]
            for key, val in result.items():
                if val is not None:
                    lines.append(f"  {key}: {json.dumps(val) if isinstance(val, (dict, list)) else val}")
            return "\n".join(lines)
        return json.dumps(result, indent=2)

    return f"Invalid action '{action}'. Must be one of: config, update_config, forecast"
