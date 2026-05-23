"""
Activity-related MCP tools for Intervals.icu.

Core tools for retrieving activities, details, intervals, streams, and messages.
"""

from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.utils.formatting import format_activity_message, format_activity_summary, format_intervals
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

from intervals_mcp_server.mcp_instance import mcp  # noqa: F401

config = get_config()

COACH_TICK_VALUES = {"amazing": 1, "good": 2, "seen": 3, "poor": 4, "wtf": 5}
COACH_TICK_LABELS = {v: k.upper() for k, v in COACH_TICK_VALUES.items()}


def _is_strava_restricted(activity: dict[str, Any]) -> bool:
    return activity.get("source") == "STRAVA" and "_note" in activity


def _parse_activities_from_result(result: Any) -> list[dict[str, Any]]:
    activities: list[dict[str, Any]] = []
    if isinstance(result, list):
        activities = [item for item in result if isinstance(item, dict)]
    elif isinstance(result, dict):
        for _key, value in result.items():
            if isinstance(value, list):
                activities = [item for item in value if isinstance(item, dict)]
                break
        if not activities and any(key in result for key in ["name", "startTime", "distance"]):
            activities = [result]
    return activities


def _filter_named_activities(activities: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [a for a in activities if a.get("name") and a.get("name") != "Unnamed"]


def _partition_activities(
    activities: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    accessible = []
    restricted = []
    for activity in activities:
        if _is_strava_restricted(activity):
            restricted.append(activity)
        else:
            accessible.append(activity)
    return accessible, restricted


async def _fetch_more_activities(
    athlete_id: str, start_date: str, api_key: str | None, api_limit: int
) -> list[dict[str, Any]]:
    oldest_date = datetime.fromisoformat(start_date)
    older_start = (oldest_date - timedelta(days=60)).strftime("%Y-%m-%d")
    older_end = (oldest_date - timedelta(days=1)).strftime("%Y-%m-%d")
    if older_start >= older_end:
        return []
    more_result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/activities", api_key=api_key,
        params={"oldest": older_start, "newest": older_end, "limit": api_limit},
    )
    if isinstance(more_result, list):
        return _filter_named_activities(more_result)
    return []


@mcp.tool()
async def get_activities(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = 10,
    include_unnamed: bool = False,
) -> str:
    """Get a list of activities for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        start_date: Start date YYYY-MM-DD (optional, defaults to 30 days ago)
        end_date: End date YYYY-MM-DD (optional, defaults to today)
        limit: Maximum number of activities (optional, defaults to 10)
        include_unnamed: Include unnamed activities (optional, defaults to False)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    api_limit = limit * 3 if not include_unnamed else limit

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities", api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": api_limit},
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if not result:
        return f"No activities found for athlete {athlete_id_to_use}."

    all_activities = _parse_activities_from_result(result)
    if not all_activities:
        return f"No valid activities found for athlete {athlete_id_to_use}."

    activities, restricted = _partition_activities(all_activities)

    if not include_unnamed:
        activities = _filter_named_activities(activities)
        if len(activities) < limit:
            more = await _fetch_more_activities(athlete_id_to_use, start_date, api_key, api_limit)
            activities.extend(more)

    activities = activities[:limit]

    if not activities:
        if restricted:
            return (
                f"No accessible activities found. {len(restricted)} activities are from Strava "
                "and cannot be accessed via the API due to Strava's data sharing policy."
            )
        return f"No named activities found. Try with include_unnamed=True."

    output = "Activities:\n\n"
    for a in activities:
        output += format_activity_summary(a) + "\n"

    if restricted:
        output += (
            f"\nNote: {len(restricted)} Strava activities cannot be accessed via API "
            "(connect your device directly to Intervals.icu instead)."
        )

    return output


@mcp.tool()
async def get_activity_details(activity_id: str, api_key: str | None = None) -> str:
    """Get detailed information for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional)
    """
    result = await make_intervals_request(url=f"/activity/{activity_id}", api_key=api_key)
    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if not result:
        return f"No details found for activity {activity_id}."

    activity_data = result[0] if isinstance(result, list) and result else result
    if not isinstance(activity_data, dict):
        return f"Invalid activity format for {activity_id}."

    detailed_view = format_activity_summary(activity_data)
    if "zones" in activity_data:
        zones = activity_data["zones"]
        detailed_view += "\nPower Zones:\n"
        for zone in zones.get("power", []):
            detailed_view += f"Zone {zone.get('number')}: {zone.get('secondsInZone')} seconds\n"
        detailed_view += "\nHeart Rate Zones:\n"
        for zone in zones.get("hr", []):
            detailed_view += f"Zone {zone.get('number')}: {zone.get('secondsInZone')} seconds\n"
    return detailed_view


@mcp.tool()
async def get_activity_intervals(activity_id: str, api_key: str | None = None) -> str:
    """Get interval data for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional)
    """
    result = await make_intervals_request(url=f"/activity/{activity_id}/intervals", api_key=api_key)
    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if not result:
        return f"No interval data found for activity {activity_id}."
    if not isinstance(result, dict) or not any(key in result for key in ["icu_intervals", "icu_groups"]):
        return f"No interval data or unrecognized format for activity {activity_id}."
    return format_intervals(result)


@mcp.tool()
async def get_activity_streams(
    activity_id: str,
    api_key: str | None = None,
    stream_types: str | None = None,
) -> str:
    """Get stream (time-series) data for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional)
        stream_types: Comma-separated types (optional, defaults to: time,watts,heartrate,cadence,altitude,distance,velocity_smooth)
    """
    params = {"types": stream_types or "time,watts,heartrate,cadence,altitude,distance,velocity_smooth"}

    result = await make_intervals_request(
        url=f"/activity/{activity_id}/streams", api_key=api_key, params=params
    )
    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if not result:
        return f"No stream data found for activity {activity_id}."

    streams = result if isinstance(result, list) else []
    if not streams:
        return f"No stream data found for activity {activity_id}."

    lines = [f"Streams for activity {activity_id}:"]
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        stype = stream.get("type", "unknown")
        data = stream.get("data", [])
        n = len(data)
        if n == 0:
            lines.append(f"  {stype}: (empty)")
        elif n <= 6:
            lines.append(f"  {stype} ({n} pts): {data}")
        else:
            lines.append(f"  {stype} ({n} pts): {data[:3]} ... {data[-3:]}")
    return "\n".join(lines)


@mcp.tool()
async def manage_activity_messages(
    activity_id: str,
    action: str = "list",
    content: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get or add messages (notes/comments) on an activity.

    Args:
        activity_id: The Intervals.icu activity ID
        action: One of: list, add (default: list)
        content: Message text (required for add)
        api_key: The Intervals.icu API key (optional)
    """
    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/activity/{activity_id}/messages", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return f"No messages for activity {activity_id}."
        messages = result if isinstance(result, list) else []
        if not messages:
            return f"No messages for activity {activity_id}."
        output = f"Messages for activity {activity_id}:\n\n"
        for msg in messages:
            if isinstance(msg, dict):
                output += format_activity_message(msg) + "\n\n"
        return output

    elif action == "add":
        if not content:
            return "Error: 'content' required for add"
        result = await make_intervals_request(
            url=f"/activity/{activity_id}/messages", api_key=api_key, method="POST", data={"content": content}
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict) and result.get("id"):
            return f"Added message (ID: {result['id']}) to activity {activity_id}."
        return f"Message added to activity {activity_id}."

    return f"Invalid action '{action}'. Must be one of: list, add"
