"""
Activity analytics MCP tools for Intervals.icu.

This module contains tools for retrieving activity analytics data including
power curves, HR curves, pace curves, histograms, best efforts, and maps.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

config = get_config()


def _format_curve_data(data: Any, curve_type: str, activity_id: str) -> str:
    """Format curve data (power, pace, HR) into a readable string."""
    if not data:
        return f"No {curve_type} curve data found for activity {activity_id}."

    if isinstance(data, dict):
        return f"{curve_type.title()} Curve for activity {activity_id}:\n\n{json.dumps(data, indent=2)}"

    if isinstance(data, list):
        output = f"{curve_type.title()} Curve for activity {activity_id}:\n\n"
        for entry in data[:50]:
            if isinstance(entry, dict):
                secs = entry.get("secs", entry.get("distance", "?"))
                value = entry.get("value", entry.get("watts", entry.get("bpm", entry.get("secs_km", "?"))))
                output += f"  {secs}: {value}\n"
            else:
                output += f"  {entry}\n"
        if len(data) > 50:
            output += f"\n  ... and {len(data) - 50} more data points\n"
        return output

    return f"{curve_type.title()} Curve for activity {activity_id}:\n\n{data}"


@mcp.tool()
async def get_best_efforts(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get best efforts for a specific activity from Intervals.icu.

    Returns peak power/pace/HR efforts at various durations (e.g. 5s, 1min, 5min, 20min).

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/best-efforts", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching best efforts: {result.get('message')}"

    if not result:
        return f"No best effort data found for activity {activity_id}."

    return f"Best Efforts for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_power_curve(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get power curve data for a specific activity from Intervals.icu.

    Returns mean maximal power values for durations from 1 second up to the full activity.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/power-curve", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power curve: {result.get('message')}"

    return _format_curve_data(result, "power", activity_id)


@mcp.tool()
async def get_activity_pace_curve(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get pace curve data for a specific activity from Intervals.icu.

    Returns best pace values for various distances.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/pace-curve", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching pace curve: {result.get('message')}"

    return _format_curve_data(result, "pace", activity_id)


@mcp.tool()
async def get_activity_hr_curve(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get heart rate curve data for a specific activity from Intervals.icu.

    Returns heart rate values sustained for various durations.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/hr-curve", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching HR curve: {result.get('message')}"

    return _format_curve_data(result, "heart rate", activity_id)


@mcp.tool()
async def get_activity_power_histogram(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get power histogram (distribution) for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/power-histogram", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power histogram: {result.get('message')}"

    if not result:
        return f"No power histogram data found for activity {activity_id}."

    return f"Power Histogram for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_pace_histogram(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get pace histogram (distribution) for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/pace-histogram", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching pace histogram: {result.get('message')}"

    if not result:
        return f"No pace histogram data found for activity {activity_id}."

    return f"Pace Histogram for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_gap_histogram(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get gradient adjusted pace (GAP) histogram for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/gap-histogram", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching GAP histogram: {result.get('message')}"

    if not result:
        return f"No GAP histogram data found for activity {activity_id}."

    return f"GAP Histogram for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_hr_histogram(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get heart rate histogram (distribution) for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/hr-histogram", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching HR histogram: {result.get('message')}"

    if not result:
        return f"No HR histogram data found for activity {activity_id}."

    return f"HR Histogram for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_power_vs_hr(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get power vs heart rate data for a specific activity from Intervals.icu.

    Useful for analyzing aerobic decoupling and cardiac drift.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/power-vs-hr", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power vs HR data: {result.get('message')}"

    if not result:
        return f"No power vs HR data found for activity {activity_id}."

    return f"Power vs HR for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_map(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get map/GPS data for a specific activity from Intervals.icu.

    Returns latitude/longitude coordinates and related geo data.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/map", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching activity map: {result.get('message')}"

    if not result:
        return f"No map data found for activity {activity_id}."

    return f"Map Data for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_segments(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get segment data for a specific activity from Intervals.icu.

    Returns matched segments (climbs, sprints, etc.) from the activity.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/segments", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching segments: {result.get('message')}"

    if not result:
        return f"No segment data found for activity {activity_id}."

    if isinstance(result, list):
        output = f"Segments for activity {activity_id}:\n\n"
        for seg in result:
            if isinstance(seg, dict):
                name = seg.get("name", "Unnamed")
                distance = seg.get("distance", "?")
                elevation = seg.get("elevation_gain", "?")
                output += f"  - {name}: {distance}m, {elevation}m gain\n"
        return output

    return f"Segments for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_weather(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get weather summary for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/weather-summary", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching weather: {result.get('message')}"

    if not result:
        return f"No weather data found for activity {activity_id}."

    if isinstance(result, dict):
        lines = [f"Weather for activity {activity_id}:", ""]
        for key, val in result.items():
            if val is not None:
                lines.append(f"  {key}: {val}")
        return "\n".join(lines)

    return f"Weather for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_interval_stats(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get interval-like stats for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/interval-stats", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching interval stats: {result.get('message')}"

    if not result:
        return f"No interval stats found for activity {activity_id}."

    return f"Interval Stats for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_hr_load_model(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get HR training load model for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/hr-load-model", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching HR load model: {result.get('message')}"

    if not result:
        return f"No HR load model data found for activity {activity_id}."

    return f"HR Load Model for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_time_at_hr(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get time spent at each heart rate for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/time-at-hr", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching time at HR: {result.get('message')}"

    if not result:
        return f"No time at HR data found for activity {activity_id}."

    return f"Time at HR for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_activity_power_spike_model(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Get power spike model for a specific activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/power-spike-model", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power spike model: {result.get('message')}"

    if not result:
        return f"No power spike model data found for activity {activity_id}."

    return f"Power Spike Model for activity {activity_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_athlete_power_curves(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get best power curve data across activities for an athlete from Intervals.icu.

    Returns mean maximal power for various durations across the date range.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        start_date: Start date in YYYY-MM-DD format (optional, defaults to 30 days ago)
        end_date: End date in YYYY-MM-DD format (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    params = {"oldest": start_date, "newest": end_date}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power curves: {result.get('message')}"

    if not result:
        return f"No power curve data found for athlete {athlete_id_to_use}."

    return f"Power Curves for athlete {athlete_id_to_use} ({start_date} to {end_date}):\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_athlete_pace_curves(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get best pace curve data across activities for an athlete from Intervals.icu.

    Returns best pace for various distances across the date range.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        start_date: Start date in YYYY-MM-DD format (optional, defaults to 30 days ago)
        end_date: End date in YYYY-MM-DD format (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    params = {"oldest": start_date, "newest": end_date}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/pace-curves",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching pace curves: {result.get('message')}"

    if not result:
        return f"No pace curve data found for athlete {athlete_id_to_use}."

    return f"Pace Curves for athlete {athlete_id_to_use} ({start_date} to {end_date}):\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_athlete_hr_curves(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get best HR curve data across activities for an athlete from Intervals.icu.

    Returns best sustained heart rate for various durations across the date range.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        start_date: Start date in YYYY-MM-DD format (optional, defaults to 30 days ago)
        end_date: End date in YYYY-MM-DD format (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    params = {"oldest": start_date, "newest": end_date}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/hr-curves",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching HR curves: {result.get('message')}"

    if not result:
        return f"No HR curve data found for athlete {athlete_id_to_use}."

    return f"HR Curves for athlete {athlete_id_to_use} ({start_date} to {end_date}):\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_athlete_mmp_model(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get the Mean Maximal Power (MMP) model for an athlete from Intervals.icu.

    Returns the modeled power curve used for training load calculations.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/mmp-model", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching MMP model: {result.get('message')}"

    if not result:
        return f"No MMP model data found for athlete {athlete_id_to_use}."

    return f"MMP Model for athlete {athlete_id_to_use}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_athlete_power_hr_curve(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get power vs HR curve data across activities for an athlete from Intervals.icu.

    Useful for tracking aerobic efficiency over time.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        start_date: Start date in YYYY-MM-DD format (optional, defaults to 30 days ago)
        end_date: End date in YYYY-MM-DD format (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    params = {"oldest": start_date, "newest": end_date}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-hr-curve",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching power vs HR curve: {result.get('message')}"

    if not result:
        return f"No power vs HR curve data found for athlete {athlete_id_to_use}."

    return f"Power vs HR Curve for athlete {athlete_id_to_use} ({start_date} to {end_date}):\n\n{json.dumps(result, indent=2)}"
