"""
Sport settings MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_sport_setting(setting: dict[str, Any]) -> str:
    lines = [f"ID: {setting.get('id', 'N/A')}", f"Type: {setting.get('type', 'Unknown')}"]
    if setting.get("ftp") is not None:
        lines.append(f"FTP: {setting['ftp']}W")
    if setting.get("lthr") is not None:
        lines.append(f"LTHR: {setting['lthr']}bpm")
    if setting.get("max_hr") is not None:
        lines.append(f"Max HR: {setting['max_hr']}bpm")
    if setting.get("resting_hr") is not None:
        lines.append(f"Resting HR: {setting['resting_hr']}bpm")
    if setting.get("threshold_pace") is not None:
        lines.append(f"Threshold Pace: {setting['threshold_pace']}m/s")
    if setting.get("weight") is not None:
        lines.append(f"Weight: {setting['weight']}kg")
    for zone_key, label in [("power_zones", "Power Zones"), ("hr_zones", "HR Zones"), ("pace_zones", "Pace Zones")]:
        zones = setting.get(zone_key)
        if zones:
            lines.append(f"\n{label}:")
            for zone in zones:
                if isinstance(zone, dict):
                    lines.append(f"  Z{zone.get('id', '?')}: {zone.get('name', '')} ({zone.get('min', '?')}-{zone.get('max', '?')})")
    return "\n".join(lines)


@mcp.tool()
async def manage_sport_settings(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    setting_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage sport settings (training zones, FTP, LTHR, thresholds) on Intervals.icu.

    Args:
        action: One of: list, get, create, update, delete
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        setting_id: Required for get, update, delete
        data: For create: {"type": "Ride", "ftp": 280, ...}. For update: fields to change.
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/sport-settings", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No sport settings found."
        if isinstance(result, list):
            return "Sport Settings:\n\n" + "\n\n".join(_format_sport_setting(s) for s in result if isinstance(s, dict))
        return json.dumps(result, indent=2)

    elif action == "get":
        if not setting_id:
            return "Error: 'setting_id' required for get"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Sport Setting:\n\n{_format_sport_setting(result)}"
        return "Not found."

    elif action == "create":
        if not data:
            return "Error: 'data' required for create (must include 'type')"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/sport-settings", api_key=api_key, method="POST", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Created sport setting (ID: {result.get('id')}).\n\n{_format_sport_setting(result)}"
        return "Unexpected response."

    elif action == "update":
        if not setting_id:
            return "Error: 'setting_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated sport setting {setting_id}.\n\n{_format_sport_setting(result)}"
        return "Unexpected response."

    elif action == "delete":
        if not setting_id:
            return "Error: 'setting_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted sport setting {setting_id}."

    return f"Invalid action '{action}'. Must be one of: list, get, create, update, delete"
