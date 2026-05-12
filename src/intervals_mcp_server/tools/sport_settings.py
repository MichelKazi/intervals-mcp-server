"""
Sport settings MCP tools for Intervals.icu.

This module contains tools for managing sport-specific settings (training zones, thresholds, etc.).
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_sport_setting(setting: dict[str, Any]) -> str:
    """Format sport setting data into a readable string."""
    lines = []
    lines.append(f"ID: {setting.get('id', 'N/A')}")
    lines.append(f"Type: {setting.get('type', 'Unknown')}")
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

    if setting.get("power_zones"):
        lines.append("\nPower Zones:")
        for zone in setting["power_zones"]:
            if isinstance(zone, dict):
                lines.append(f"  Z{zone.get('id', '?')}: {zone.get('name', '')} ({zone.get('min', '?')}-{zone.get('max', '?')}W)")

    if setting.get("hr_zones"):
        lines.append("\nHR Zones:")
        for zone in setting["hr_zones"]:
            if isinstance(zone, dict):
                lines.append(f"  Z{zone.get('id', '?')}: {zone.get('name', '')} ({zone.get('min', '?')}-{zone.get('max', '?')}bpm)")

    if setting.get("pace_zones"):
        lines.append("\nPace Zones:")
        for zone in setting["pace_zones"]:
            if isinstance(zone, dict):
                lines.append(f"  Z{zone.get('id', '?')}: {zone.get('name', '')}")

    return "\n".join(lines)


@mcp.tool()
async def get_sport_settings(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all sport settings (training zones, thresholds) for an athlete from Intervals.icu.

    Returns settings for each sport type including power zones, HR zones, pace zones,
    FTP, LTHR, and threshold pace.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/sport-settings", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching sport settings: {result.get('message')}"

    if not result:
        return f"No sport settings found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Sport Settings:\n\n"
        for setting in result:
            if isinstance(setting, dict):
                output += _format_sport_setting(setting) + "\n\n"
        return output

    return f"Sport Settings:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_sport_setting(
    setting_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get a specific sport setting by ID from Intervals.icu.

    Args:
        setting_id: The sport setting ID
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching sport setting: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No sport setting found with ID {setting_id}."

    return f"Sport Setting Details:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def create_sport_setting(
    sport_type: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    ftp: int | None = None,
    lthr: int | None = None,
    max_hr: int | None = None,
    resting_hr: int | None = None,
    threshold_pace: float | None = None,
    weight: float | None = None,
) -> str:
    """Create a new sport setting (training zones config) for an athlete on Intervals.icu.

    Args:
        sport_type: Sport type (e.g. "Ride", "Run", "Swim", "VirtualRide")
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        ftp: Functional Threshold Power in watts (optional)
        lthr: Lactate Threshold Heart Rate in bpm (optional)
        max_hr: Maximum Heart Rate in bpm (optional)
        resting_hr: Resting Heart Rate in bpm (optional)
        threshold_pace: Threshold pace in m/s (optional)
        weight: Weight in kg (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data: dict[str, Any] = {"type": sport_type}
    if ftp is not None:
        data["ftp"] = ftp
    if lthr is not None:
        data["lthr"] = lthr
    if max_hr is not None:
        data["max_hr"] = max_hr
    if resting_hr is not None:
        data["resting_hr"] = resting_hr
    if threshold_pace is not None:
        data["threshold_pace"] = threshold_pace
    if weight is not None:
        data["weight"] = weight

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/sport-settings",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating sport setting: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when creating sport setting."

    return f"Successfully created sport setting (ID: {result.get('id')}).\n\n{_format_sport_setting(result)}"


@mcp.tool()
async def update_sport_setting(
    setting_id: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update a sport setting on Intervals.icu.

    Args:
        setting_id: The sport setting ID to update
        updates: Dictionary of fields to update (e.g. {"ftp": 280, "lthr": 165})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating sport setting: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating sport setting."

    return f"Successfully updated sport setting {setting_id}.\n\n{_format_sport_setting(result)}"


@mcp.tool()
async def delete_sport_setting(
    setting_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Delete a sport setting from Intervals.icu.

    Args:
        setting_id: The sport setting ID to delete
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/sport-settings/{setting_id}",
        api_key=api_key,
        method="DELETE",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error deleting sport setting: {result.get('message')}"

    return f"Successfully deleted sport setting {setting_id}."
