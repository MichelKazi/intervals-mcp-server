"""
Activity review and convenience tools for Intervals.icu.

Provides composite tools that combine multiple API calls into single operations,
reducing round-trips and token usage in LLM conversations.
"""

from collections import defaultdict
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
from intervals_mcp_server.tools.coaching_analytics import (
    _fetch_activities_range,
    _fetch_events_range,
    _fetch_wellness_range,
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


@mcp.tool()
async def get_daily_summary(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Morning briefing: today's wellness, yesterday's activities, today's planned workouts, and current training load.

    Combines wellness, activities, events, and fitness data into a single call for
    a daily coaching check-in. Useful as the first call in a coaching conversation.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    today = datetime.now().strftime("%Y-%m-%d")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

    wellness = await _fetch_wellness_range(athlete_id_to_use, yesterday, today, api_key)
    activities = await _fetch_activities_range(athlete_id_to_use, yesterday, today, api_key)
    events = await _fetch_events_range(athlete_id_to_use, today, tomorrow, api_key)

    lines = [f"Daily Summary ({today}):"]

    # Wellness / readiness
    today_wellness = None
    for w in wellness:
        if w.get("id", "")[:10] == today:
            today_wellness = w
            break
    if not today_wellness and wellness:
        today_wellness = wellness[-1]

    if today_wellness:
        lines.append("")
        lines.append("Wellness:")
        ctl = today_wellness.get("ctl")
        atl = today_wellness.get("atl")
        if ctl is not None and atl is not None:
            tsb = round(ctl - atl, 1)
            if tsb > 5:
                form = "Fresh"
            elif tsb > -10:
                form = "Neutral"
            elif tsb > -25:
                form = "Fatigued"
            else:
                form = "Very Fatigued"
            lines.append(f"  CTL: {ctl} | ATL: {atl} | TSB: {tsb} ({form})")

        rhr = today_wellness.get("restingHR")
        hrv = today_wellness.get("hrv")
        weight = today_wellness.get("weight")
        sleep_secs = today_wellness.get("sleepSecs")
        parts = []
        if rhr:
            parts.append(f"RHR: {rhr}")
        if hrv:
            parts.append(f"HRV: {hrv}")
        if weight:
            parts.append(f"Weight: {weight}kg")
        if sleep_secs:
            parts.append(f"Sleep: {round(sleep_secs / 3600, 1)}h")
        if parts:
            lines.append(f"  {' | '.join(parts)}")

        subjective = []
        for key, label in [("soreness", "Sore"), ("fatigue", "Fatigue"), ("stress", "Stress"), ("mood", "Mood")]:
            val = today_wellness.get(key)
            if val is not None:
                subjective.append(f"{label}:{val}")
        if subjective:
            lines.append(f"  {', '.join(subjective)}")

    # Yesterday's activities
    yesterday_acts = [
        a for a in activities
        if (a.get("start_date_local") or a.get("startTime", ""))[:10] == yesterday
    ]
    if yesterday_acts:
        lines.append("")
        lines.append("Yesterday's Activities:")
        for act in yesterday_acts:
            name = act.get("name", "Unnamed")
            atype = act.get("type", "")
            dur = act.get("moving_time") or act.get("elapsed_time")
            load = act.get("icu_training_load") or act.get("trainingLoad")
            parts = [f"  {name}"]
            if atype:
                parts[0] += f" ({atype})"
            if dur:
                parts.append(_seconds_to_hms(dur))
            if load:
                parts.append(f"Load: {load:.0f}")
            tick = act.get("coach_tick")
            if tick:
                label = COACH_TICK_LABELS.get(tick, "")
                if label:
                    parts.append(f"Coach: {label}")
            lines.append(" | ".join(parts))

    # Today's planned workouts
    planned = [e for e in events if e.get("category") == "WORKOUT"]
    if planned:
        lines.append("")
        lines.append("Today's Plan:")
        for event in planned:
            name = event.get("name", "Unnamed")
            etype = event.get("type", "")
            dur = event.get("moving_time") or event.get("duration")
            load = event.get("icu_training_load") or event.get("load")
            desc = event.get("description", "")
            parts = [f"  {name}"]
            if etype:
                parts[0] += f" ({etype})"
            if dur:
                parts.append(_seconds_to_hms(dur))
            if load:
                parts.append(f"Target Load: {load:.0f}")
            lines.append(" | ".join(parts))
            if desc:
                lines.append(f"    {desc[:120]}")
    elif not yesterday_acts:
        lines.append("")
        lines.append("No planned workouts for today and no activities yesterday.")

    return "\n".join(lines)


@mcp.tool()
async def get_week_in_review(
    athlete_id: str | None = None,
    api_key: str | None = None,
    weeks_ago: int = 0,
) -> str:
    """Weekly coaching review: activities with coach ticks, load progression, zone distribution, and plan compliance.

    Summarizes the past 7 days (or a specified prior week) with per-activity ratings,
    aggregated zone time, total load vs plan, and highlights. Designed for end-of-week
    coaching conversations.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        weeks_ago: 0 for current week, 1 for last week, etc. (optional, defaults to 0)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    now = datetime.now()
    end = now - timedelta(weeks=weeks_ago)
    start = end - timedelta(days=7)
    start_date = start.strftime("%Y-%m-%d")
    end_date = end.strftime("%Y-%m-%d")

    activities = await _fetch_activities_range(athlete_id_to_use, start_date, end_date, api_key)
    events = await _fetch_events_range(athlete_id_to_use, start_date, end_date, api_key)
    wellness = await _fetch_wellness_range(athlete_id_to_use, start_date, end_date, api_key)

    lines = [f"Week in Review ({start_date} to {end_date}):"]

    if not activities:
        lines.append("  No activities this week.")
        return "\n".join(lines)

    # Per-activity summary
    lines.append("")
    lines.append("Activities:")
    total_load = 0.0
    total_duration = 0.0
    total_distance = 0.0
    by_type: dict[str, int] = defaultdict(int)
    power_zones: dict[int, float] = defaultdict(float)
    hr_zones: dict[int, float] = defaultdict(float)
    unreviewed = []

    for act in sorted(activities, key=lambda a: a.get("start_date_local", a.get("startTime", ""))):
        name = act.get("name", "Unnamed")
        atype = act.get("type", "Other")
        date = (act.get("start_date_local") or act.get("startTime", ""))[:10]
        dur = act.get("moving_time") or act.get("elapsed_time") or 0
        load = act.get("icu_training_load") or act.get("trainingLoad") or 0
        dist = act.get("distance") or 0
        tick = act.get("coach_tick")

        total_load += load
        total_duration += dur
        total_distance += dist
        by_type[atype] += 1

        tick_str = ""
        if tick:
            tick_str = f" [{COACH_TICK_LABELS.get(tick, '?')}]"
        else:
            unreviewed.append(act.get("id", ""))

        parts = [f"  {date} {name} ({atype})"]
        if dur:
            parts.append(_seconds_to_hms(dur))
        if load:
            parts.append(f"Load:{load:.0f}")
        lines.append(f"{' | '.join(parts)}{tick_str}")

        # Aggregate zones
        pz = act.get("icu_zone_times")
        if isinstance(pz, list):
            for i, secs in enumerate(pz):
                if isinstance(secs, (int, float)) and secs > 0:
                    power_zones[i + 1] += secs
        hz = act.get("icu_hr_zone_times")
        if isinstance(hz, list):
            for i, secs in enumerate(hz):
                if isinstance(secs, (int, float)) and secs > 0:
                    hr_zones[i + 1] += secs

    # Totals
    lines.append("")
    lines.append("Totals:")
    type_summary = ", ".join(f"{v}x {k}" for k, v in sorted(by_type.items()))
    lines.append(f"  {len(activities)} activities ({type_summary})")
    lines.append(f"  Duration: {_seconds_to_hms(total_duration)} | Distance: {total_distance/1000:.1f}km | Load: {total_load:.0f}")

    # Zone distribution (compact)
    total_pz_time = sum(power_zones.values())
    if total_pz_time > 0:
        lines.append("")
        lines.append("Power Zones:")
        zone_parts = []
        for z in sorted(power_zones.keys()):
            pct = round(power_zones[z] / total_pz_time * 100)
            if pct > 0:
                zone_parts.append(f"Z{z}:{pct}%")
        lines.append(f"  {' | '.join(zone_parts)}")
        easy = sum(power_zones.get(z, 0) for z in [1, 2])
        hard = sum(power_zones.get(z, 0) for z in [5, 6, 7])
        lines.append(f"  Easy: {round(easy/total_pz_time*100)}% | Hard: {round(hard/total_pz_time*100)}%")

    # Plan compliance
    planned = [e for e in events if e.get("category") == "WORKOUT"]
    if planned:
        completed = 0
        planned_load = 0.0
        for event in planned:
            event_date = (event.get("start_date_local") or event.get("date", ""))[:10]
            pl = event.get("icu_training_load") or event.get("load") or 0
            planned_load += pl
            day_acts = [
                a for a in activities
                if (a.get("start_date_local") or a.get("startTime", ""))[:10] == event_date
            ]
            if day_acts:
                completed += 1
        lines.append("")
        compliance = round(completed / len(planned) * 100) if planned else 0
        lines.append(f"Plan Compliance: {completed}/{len(planned)} workouts ({compliance}%)")
        if planned_load > 0:
            lines.append(f"  Planned Load: {planned_load:.0f} | Actual: {total_load:.0f} ({round(total_load/planned_load*100)}%)")

    # CTL progression over the week
    if wellness:
        first_w = wellness[0]
        last_w = wellness[-1]
        ctl_start = first_w.get("ctl")
        ctl_end = last_w.get("ctl")
        if ctl_start is not None and ctl_end is not None:
            delta = round(ctl_end - ctl_start, 1)
            lines.append("")
            lines.append(f"Fitness: CTL {ctl_start} → {ctl_end} ({'+' if delta >= 0 else ''}{delta})")

    # Unreviewed activities
    if unreviewed:
        lines.append("")
        lines.append(f"Unreviewed: {len(unreviewed)} activities need coach tick")

    return "\n".join(lines)
