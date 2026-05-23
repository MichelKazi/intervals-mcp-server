"""
Activity analytics MCP tools for Intervals.icu.

Consolidated tools for curves, histograms, best efforts, and miscellaneous analytics.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

config = get_config()


def _compact_json(data: Any) -> str:
    if isinstance(data, dict):
        cleaned = {k: v for k, v in data.items() if v is not None}
        return json.dumps(cleaned, separators=(", ", ": "))
    if isinstance(data, list) and len(data) > 30:
        return json.dumps(data[:30], separators=(", ", ": ")) + f"\n... ({len(data)} total)"
    return json.dumps(data, separators=(", ", ": "))


def _format_duration(secs: int | float) -> str:
    s = int(secs)
    if s < 60:
        return f"{s}s"
    if s < 3600:
        return f"{s // 60}m{s % 60:02d}s" if s % 60 else f"{s // 60}m"
    h = s // 3600
    m = (s % 3600) // 60
    return f"{h}h{m:02d}m" if m else f"{h}h"


_KEY_DURATIONS = {1, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600, 5400, 7200}


def _format_curve_data(data: Any, curve_type: str, activity_id: str) -> str:
    if not data:
        return f"No {curve_type} curve data found for activity {activity_id}."

    if isinstance(data, list) and data and isinstance(data[0], dict):
        output = f"{curve_type.title()} Curve for activity {activity_id} ({len(data)} points):\n"
        for entry in data:
            secs = entry.get("secs", entry.get("distance"))
            if secs is not None and int(secs) in _KEY_DURATIONS:
                value = entry.get("value", entry.get("watts", entry.get("bpm", entry.get("secs_km", "?"))))
                output += f"  {_format_duration(secs)}: {value}\n"
        return output

    if isinstance(data, list) and data:
        output = f"{curve_type.title()} Curve for activity {activity_id} ({len(data)} points):\n"
        for s in sorted(_KEY_DURATIONS):
            if s < len(data) and data[s] is not None:
                output += f"  {_format_duration(s)}: {data[s]}\n"
        return output

    if isinstance(data, dict):
        lines = [f"{curve_type.title()} Curve for activity {activity_id}:"]
        for k, v in data.items():
            if v is not None:
                lines.append(f"  {k}: {v}")
        return "\n".join(lines)

    return f"{curve_type.title()} Curve for activity {activity_id}: {data}"


@mcp.tool()
async def get_activity_curve(
    activity_id: str,
    curve_type: str = "power",
    api_key: str | None = None,
) -> str:
    """Get curve data (mean maximal values over durations) for a specific activity.

    Args:
        activity_id: The Intervals.icu activity ID
        curve_type: Type of curve - one of: power, pace, hr (default: power)
        api_key: The Intervals.icu API key (optional)
    """
    endpoints = {
        "power": "power-curve",
        "pace": "pace-curve",
        "hr": "hr-curve",
    }
    curve_type_lower = curve_type.lower().strip()
    endpoint = endpoints.get(curve_type_lower)
    if not endpoint:
        return f"Invalid curve_type '{curve_type}'. Must be one of: {', '.join(endpoints.keys())}"

    result = await make_intervals_request(
        url=f"/activity/{activity_id}/{endpoint}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching {curve_type} curve: {result.get('message')}"

    return _format_curve_data(result, curve_type_lower, activity_id)


@mcp.tool()
async def get_activity_histogram(
    activity_id: str,
    histogram_type: str = "power",
    api_key: str | None = None,
) -> str:
    """Get histogram (distribution) data for a specific activity.

    Args:
        activity_id: The Intervals.icu activity ID
        histogram_type: Type of histogram - one of: power, pace, gap, hr (default: power)
        api_key: The Intervals.icu API key (optional)
    """
    endpoints = {
        "power": "power-histogram",
        "pace": "pace-histogram",
        "gap": "gap-histogram",
        "hr": "hr-histogram",
    }
    hist_lower = histogram_type.lower().strip()
    endpoint = endpoints.get(hist_lower)
    if not endpoint:
        return f"Invalid histogram_type '{histogram_type}'. Must be one of: {', '.join(endpoints.keys())}"

    result = await make_intervals_request(
        url=f"/activity/{activity_id}/{endpoint}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching {histogram_type} histogram: {result.get('message')}"

    if not result:
        return f"No {histogram_type} histogram data found for activity {activity_id}."

    return f"{hist_lower.upper()} Histogram for activity {activity_id}:\n\n{_compact_json(result)}"


@mcp.tool()
async def get_activity_analytics(
    activity_id: str,
    analytic_type: str = "power_vs_hr",
    api_key: str | None = None,
    start_index: int = 0,
    end_index: int | None = None,
) -> str:
    """Get miscellaneous analytics for a specific activity.

    Args:
        activity_id: The Intervals.icu activity ID
        analytic_type: Type of analytic - one of: power_vs_hr, map, segments, weather, interval_stats, hr_load_model, time_at_hr, power_spike_model (default: power_vs_hr)
        api_key: The Intervals.icu API key (optional)
        start_index: Stream start index for interval_stats (default 0)
        end_index: Stream end index for interval_stats (optional)
    """
    endpoints = {
        "power_vs_hr": "power-vs-hr",
        "map": "map",
        "segments": "segments",
        "weather": "weather-summary",
        "interval_stats": "interval-stats",
        "hr_load_model": "hr-load-model",
        "time_at_hr": "time-at-hr",
        "power_spike_model": "power-spike-model",
    }
    type_lower = analytic_type.lower().strip()
    endpoint = endpoints.get(type_lower)
    if not endpoint:
        return f"Invalid analytic_type '{analytic_type}'. Must be one of: {', '.join(endpoints.keys())}"

    params: dict[str, str] = {}
    if type_lower == "interval_stats":
        if end_index is None:
            details = await make_intervals_request(
                url=f"/activity/{activity_id}", api_key=api_key
            )
            if isinstance(details, dict) and "moving_time" in details:
                end_index = int(details["moving_time"])
            else:
                end_index = 3600
        params = {"start_index": str(start_index), "end_index": str(end_index)}

    result = await make_intervals_request(
        url=f"/activity/{activity_id}/{endpoint}",
        api_key=api_key,
        params=params if params else None,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching {analytic_type}: {result.get('message')}"

    if not result:
        return f"No {analytic_type} data found for activity {activity_id}."

    # Special formatting for segments
    if type_lower == "segments" and isinstance(result, list):
        output = f"Segments for activity {activity_id}:\n\n"
        for seg in result:
            if isinstance(seg, dict):
                name = seg.get("name", "Unnamed")
                distance = seg.get("distance", "?")
                elevation = seg.get("elevation_gain", "?")
                output += f"  - {name}: {distance}m, {elevation}m gain\n"
        return output

    # Special formatting for weather
    if type_lower == "weather" and isinstance(result, dict):
        lines = [f"Weather for activity {activity_id}:", ""]
        for key, val in result.items():
            if val is not None:
                lines.append(f"  {key}: {val}")
        return "\n".join(lines)

    return f"{analytic_type.replace('_', ' ').title()} for activity {activity_id}:\n\n{_compact_json(result)}"


@mcp.tool()
async def get_best_efforts(
    activity_id: str,
    api_key: str | None = None,
    stream: str = "watts",
    durations: str = "5,60,300,1200,3600",
) -> str:
    """Get best efforts for a specific activity from Intervals.icu.

    Returns peak power/pace/HR efforts at various durations.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional)
        stream: Stream type to query (default "watts"; also "heartrate", "speed", "cadence")
        durations: Comma-separated durations in seconds to query (default "5,60,300,1200,3600")
    """
    all_efforts: list[dict] = []
    for dur_str in durations.split(","):
        dur = dur_str.strip()
        if not dur:
            continue
        result = await make_intervals_request(
            url=f"/activity/{activity_id}/best-efforts",
            api_key=api_key,
            params={"stream": stream, "duration": dur},
        )
        if isinstance(result, dict) and "error" not in result:
            result["query_duration"] = int(dur)
            all_efforts.append(result)
        elif isinstance(result, dict) and "efforts" in result:
            for e in result["efforts"]:
                e["query_duration"] = int(dur)
            all_efforts.append(result)

    if not all_efforts:
        return f"No best effort data found for activity {activity_id}."

    return f"Best Efforts ({stream}) for activity {activity_id}:\n\n{_compact_json(all_efforts)}"


@mcp.tool()
async def get_athlete_curves(
    curve_type: str = "power",
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    activity_type: str = "Ride",
) -> str:
    """Get best curve data across all activities for an athlete over a date range.

    Args:
        curve_type: Type of curve - one of: power, pace, hr, mmp_model, power_hr (default: power)
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        start_date: Start date in YYYY-MM-DD format (optional, defaults to 30 days ago)
        end_date: End date in YYYY-MM-DD format (optional, defaults to today)
        activity_type: Activity type filter (default "Ride"; also "Run", "Swim", etc.)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    endpoints = {
        "power": "power-curves",
        "pace": "pace-curves",
        "hr": "hr-curves",
        "mmp_model": "mmp-model",
        "power_hr": "power-hr-curve",
    }
    type_lower = curve_type.lower().strip()
    endpoint = endpoints.get(type_lower)
    if not endpoint:
        return f"Invalid curve_type '{curve_type}'. Must be one of: {', '.join(endpoints.keys())}"

    start_date, end_date = resolve_date_params(start_date, end_date)

    params: dict[str, str] = {"type": activity_type}
    if type_lower == "mmp_model":
        params = {"type": activity_type}
    elif type_lower == "power_hr":
        params = {"start": start_date, "end": end_date, "type": activity_type}
    else:
        params = {"oldest": start_date, "newest": end_date}
        if type_lower == "power":
            params["type"] = activity_type

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/{endpoint}",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching {curve_type} curves: {result.get('message')}"

    if not result:
        return f"No {curve_type} curve data found for athlete {athlete_id_to_use}."

    label = curve_type.replace("_", " ").title()
    return f"{label} Curves for athlete {athlete_id_to_use} ({start_date} to {end_date}):\n\n{_compact_json(result)}"
