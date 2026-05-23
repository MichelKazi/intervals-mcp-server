"""
Activity review and convenience tools for Intervals.icu.

Provides composite tools that combine multiple API calls into single operations,
reducing round-trips and token usage in LLM conversations.
"""

from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.tools.activities import (
    COACH_TICK_LABELS,
    COACH_TICK_VALUES,
    _is_strava_restricted,
)
from intervals_mcp_server.utils.formatting import format_activity_summary
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _seconds_to_hms(secs: int | float | None) -> str:
    if not secs:
        return "0:00"
    s = int(secs)
    h, m = divmod(s, 3600)
    m, sec = divmod(m, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{sec:02d}s"


def _summarize_intervals(intervals_data: dict[str, Any]) -> str:
    """Produce a compact interval summary with key stats."""
    intervals = intervals_data.get("icu_intervals", [])
    if not intervals:
        return "No interval data."

    # Separate work vs rest intervals
    work = [i for i in intervals if i.get("type") in ("WORK", "INTERVAL")]
    rest = [i for i in intervals if i.get("type") in ("REST", "RECOVERY")]

    lines = []
    if work:
        powers = [i["average_watts"] for i in work if i.get("average_watts")]
        hrs = [i["average_heartrate"] for i in work if i.get("average_heartrate")]
        durations = [i.get("elapsed_time", 0) for i in work]

        lines.append(f"Work intervals: {len(work)}")
        if powers:
            lines.append(f"  Power: avg {sum(powers)//len(powers)}W, max {max(powers)}W, min {min(powers)}W")
        if hrs:
            lines.append(f"  HR: avg {sum(hrs)//len(hrs)}, max {max(hrs)} bpm")
        if durations:
            lines.append(f"  Duration: {_seconds_to_hms(min(durations))} - {_seconds_to_hms(max(durations))}")

        # Consistency check (power fade)
        if len(powers) >= 3:
            first_half = powers[: len(powers) // 2]
            second_half = powers[len(powers) // 2 :]
            first_avg = sum(first_half) / len(first_half)
            second_avg = sum(second_half) / len(second_half)
            if first_avg > 0:
                fade = round((first_avg - second_avg) / first_avg * 100, 1)
                if fade > 5:
                    lines.append(f"  Power fade: {fade}% (first half vs second half)")
                elif fade < -5:
                    lines.append(f"  Negative split: {-fade}% stronger in second half")

    if rest:
        rest_hrs = [i["average_heartrate"] for i in rest if i.get("average_heartrate")]
        if rest_hrs:
            lines.append(f"Recovery intervals: {len(rest)}, avg HR {sum(rest_hrs)//len(rest_hrs)} bpm")

    return "\n".join(lines)


def _summarize_streams(streams: list[dict[str, Any]]) -> str:
    """Produce a compact stream summary with computed stats."""
    if not streams:
        return "No stream data."

    lines = []
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        stype = stream.get("type", "unknown")
        data = stream.get("data", [])
        if not data:
            continue

        numeric = [v for v in data if isinstance(v, (int, float)) and v > 0]
        if not numeric:
            continue

        avg = sum(numeric) / len(numeric)
        if stype == "watts":
            lines.append(f"Power: avg {avg:.0f}W, max {max(numeric)}W, NP approx {_approx_np(numeric):.0f}W")
        elif stype == "heartrate":
            lines.append(f"HR: avg {avg:.0f}, max {max(numeric)}, min {min(numeric)} bpm")
            # HR drift: compare first half to second half avg
            mid = len(numeric) // 2
            if mid > 10:
                first_avg = sum(numeric[:mid]) / mid
                second_avg = sum(numeric[mid:]) / (len(numeric) - mid)
                drift = round((second_avg - first_avg) / first_avg * 100, 1)
                if abs(drift) > 2:
                    lines.append(f"  HR drift: {'+' if drift > 0 else ''}{drift}%")
        elif stype == "cadence":
            lines.append(f"Cadence: avg {avg:.0f} rpm")
        elif stype == "altitude":
            lines.append(f"Altitude: {min(numeric):.0f}-{max(numeric):.0f}m, gain ~{_est_elevation_gain(numeric):.0f}m")

    return "\n".join(lines)


def _approx_np(watts: list[int | float]) -> float:
    """Approximate normalized power from a watts stream (30s rolling avg ^ 4)."""
    if len(watts) < 30:
        return sum(watts) / len(watts) if watts else 0
    rolling = []
    window = 30
    for i in range(window, len(watts)):
        avg = sum(watts[i - window : i]) / window
        rolling.append(avg**4)
    return (sum(rolling) / len(rolling)) ** 0.25 if rolling else 0


def _est_elevation_gain(alt: list[int | float]) -> float:
    """Estimate elevation gain from altitude stream."""
    gain = 0.0
    for i in range(1, len(alt)):
        diff = alt[i] - alt[i - 1]
        if diff > 0:
            gain += diff
    return gain


@mcp.tool()
async def get_latest_activity(
    athlete_id: str | None = None,
    api_key: str | None = None,
    activity_type: str | None = None,
    include_intervals: bool = True,
) -> str:
    """Get the most recent activity with full details and interval summary in one call.

    This is a convenience tool that combines get_activities + get_activity_details +
    get_activity_intervals into a single operation, saving multiple round-trips.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        activity_type: Filter by type e.g. Ride, Run, Swim (optional)
        include_intervals: Whether to include interval analysis (default True)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": 20},
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message', 'Unknown error')}"

    if not isinstance(result, list) or not result:
        return "No activities found in the last 30 days."

    # Filter out Strava-restricted stubs and optionally by type
    candidates = [
        a for a in result
        if isinstance(a, dict) and not _is_strava_restricted(a) and a.get("name")
    ]

    if activity_type:
        type_lower = activity_type.lower()
        typed = [a for a in candidates if (a.get("type") or "").lower() == type_lower]
        if typed:
            candidates = typed

    if not candidates:
        # Check if all are strava-restricted
        restricted = [a for a in result if isinstance(a, dict) and _is_strava_restricted(a)]
        if restricted:
            return (
                f"No accessible activities found. {len(restricted)} activities are from Strava "
                "and cannot be accessed via the API due to Strava's data sharing policy."
            )
        return "No named activities found in the last 30 days."

    latest = candidates[0]
    activity_id = latest.get("id")

    # Fetch full details
    details = await make_intervals_request(
        url=f"/activity/{activity_id}", api_key=api_key
    )
    if isinstance(details, dict) and "error" not in details:
        latest = details

    lines = [format_activity_summary(latest)]

    # Fetch and summarize intervals
    if include_intervals:
        intervals_result = await make_intervals_request(
            url=f"/activity/{activity_id}/intervals", api_key=api_key
        )
        if isinstance(intervals_result, dict) and "icu_intervals" in intervals_result:
            summary = _summarize_intervals(intervals_result)
            if summary:
                lines.append("Interval Summary:")
                lines.append(summary)

    return "\n".join(lines)


@mcp.tool()
async def review_activity(
    activity_id: str,
    rating: str | None = None,
    comment: str | None = None,
    api_key: str | None = None,
) -> str:
    """Fetch activity details, intervals, and stream stats in one call for coaching review.

    Optionally sets a coach tick rating and posts a comment. Returns a comprehensive
    but compact summary suitable for coaching analysis.

    Args:
        activity_id: The Intervals.icu activity ID
        rating: Optional coach tick rating (amazing, good, seen, poor, wtf)
        comment: Optional coach comment to post on the activity
        api_key: The Intervals.icu API key (optional)
    """
    # Fetch details
    details = await make_intervals_request(
        url=f"/activity/{activity_id}", api_key=api_key
    )
    if isinstance(details, dict) and "error" in details:
        return f"Error fetching activity: {details.get('message', 'Unknown error')}"

    if not isinstance(details, dict):
        return f"No details found for activity {activity_id}."

    # Fetch intervals
    intervals_result = await make_intervals_request(
        url=f"/activity/{activity_id}/intervals", api_key=api_key
    )

    # Fetch key streams for analysis
    streams_result = await make_intervals_request(
        url=f"/activity/{activity_id}/streams",
        api_key=api_key,
        params={"types": "watts,heartrate,cadence,altitude"},
    )

    # Build response
    lines = ["Activity Review:", ""]
    lines.append(format_activity_summary(details))

    # Interval summary
    if isinstance(intervals_result, dict) and "icu_intervals" in intervals_result:
        interval_summary = _summarize_intervals(intervals_result)
        if interval_summary:
            lines.append("")
            lines.append("Interval Analysis:")
            lines.append(interval_summary)

    # Stream stats
    if isinstance(streams_result, list) and streams_result:
        stream_summary = _summarize_streams(streams_result)
        if stream_summary:
            lines.append("")
            lines.append("Stream Stats:")
            lines.append(stream_summary)

    # Planned vs actual (if paired event exists)
    paired_event_id = details.get("paired_event_id")
    if paired_event_id:
        planned_load = details.get("icu_planned_training_load")
        actual_load = details.get("icu_training_load") or details.get("trainingLoad")
        planned_dur = details.get("icu_planned_duration") or details.get("icu_planned_moving_time")
        actual_dur = details.get("moving_time") or details.get("elapsed_time")

        compliance_parts = []
        if planned_load and actual_load:
            pct = round(actual_load / planned_load * 100)
            compliance_parts.append(f"Load: {actual_load:.0f}/{planned_load:.0f} ({pct}%)")
        if planned_dur and actual_dur:
            pct = round(actual_dur / planned_dur * 100)
            compliance_parts.append(f"Duration: {_seconds_to_hms(actual_dur)}/{_seconds_to_hms(planned_dur)} ({pct}%)")
        if compliance_parts:
            lines.append("")
            lines.append(f"Planned vs Actual: {', '.join(compliance_parts)}")

    # Apply rating if provided
    actions = []
    if rating:
        rating_lower = rating.lower().strip()
        tick_value = COACH_TICK_VALUES.get(rating_lower)
        if tick_value:
            tick_result = await make_intervals_request(
                url=f"/activity/{activity_id}",
                api_key=api_key,
                method="PUT",
                data={"coach_tick": tick_value},
            )
            if isinstance(tick_result, dict) and "error" not in tick_result:
                label = COACH_TICK_LABELS.get(tick_value, rating)
                actions.append(f"Coach tick set to {label}")
            else:
                actions.append(f"Failed to set coach tick: {tick_result.get('message', 'unknown error') if isinstance(tick_result, dict) else 'unexpected response'}")
        else:
            valid = ", ".join(COACH_TICK_VALUES.keys())
            actions.append(f"Invalid rating '{rating}' (must be: {valid})")

    # Post comment if provided
    if comment:
        msg_result = await make_intervals_request(
            url=f"/activity/{activity_id}/messages",
            api_key=api_key,
            method="POST",
            data={"content": comment},
        )
        if isinstance(msg_result, dict) and "error" not in msg_result:
            actions.append("Comment posted")
        else:
            actions.append(f"Failed to post comment: {msg_result.get('message', 'unknown error') if isinstance(msg_result, dict) else 'unexpected response'}")

    if actions:
        lines.append("")
        lines.append("Actions: " + " | ".join(actions))

    return "\n".join(lines)
