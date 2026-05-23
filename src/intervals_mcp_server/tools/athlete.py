"""
Athlete profile MCP tools for Intervals.icu.

This module contains tools for retrieving and updating athlete profiles.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.resource_store import athlete_profile
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_athlete(data: dict[str, Any]) -> str:
    """Format athlete data into a readable string."""
    lines = ["Athlete Profile:", ""]
    fields = [
        ("id", "ID"),
        ("name", "Name"),
        ("email", "Email"),
        ("sex", "Sex"),
        ("birthday", "Birthday"),
        ("city", "City"),
        ("country", "Country"),
        ("bio", "Bio"),
        ("weight", "Weight (kg)"),
        ("locale", "Locale"),
        ("timezone", "Timezone"),
        ("privacy", "Privacy"),
        ("plan", "Plan"),
    ]
    for key, label in fields:
        val = data.get(key)
        if val is not None:
            lines.append(f"{label}: {val}")

    if data.get("sportSettings"):
        lines.append("")
        lines.append("Sport Settings:")
        for sport in data["sportSettings"]:
            if isinstance(sport, dict):
                sport_type = sport.get("type", "Unknown")
                ftp = sport.get("ftp")
                lthr = sport.get("lthr")
                threshold_pace = sport.get("threshold_pace")
                line = f"  - {sport_type}"
                if ftp:
                    line += f" | FTP: {ftp}W"
                if lthr:
                    line += f" | LTHR: {lthr}bpm"
                if threshold_pace:
                    line += f" | Threshold Pace: {threshold_pace}m/s"
                lines.append(line)

    return "\n".join(lines)


@mcp.tool()
async def get_athlete(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get athlete profile information from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching athlete: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No athlete data found for {athlete_id_to_use}."

    athlete_profile.update_from_athlete(result)
    return _format_athlete(result)


@mcp.tool()
async def update_athlete(
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update athlete profile on Intervals.icu.

    Args:
        updates: Dictionary of fields to update (e.g. {"weight": 72.5, "city": "London"})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating athlete: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating athlete."

    return f"Successfully updated athlete profile.\n\n{_format_athlete(result)}"


@mcp.tool()
async def get_athlete_profile(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get the public profile for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/profile", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching athlete profile: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No profile data found for {athlete_id_to_use}."

    return _format_athlete(result)


@mcp.tool()
async def get_training_plan(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get the training plan for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/training-plan", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching training plan: {result.get('message')}"

    if not result:
        return f"No training plan found for {athlete_id_to_use}."

    return f"Training Plan:\n\n{json.dumps(result, indent=2)}"
