"""
Coaching analytics MCP tools for Intervals.icu.

Provides pre-computed training analysis to minimize token usage in LLM coaching
conversations. These tools call existing API endpoints but do the number-crunching
in Python and return compact, actionable summaries.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

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


def _safe_div(a: float | None, b: float | None) -> float | None:
    if not a or not b:
        return None
    return round(a / b, 2)


def _week_key(date_str: str) -> str:
    """Return ISO week label like '2024-W03' from a date string."""
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        return f"{dt.isocalendar()[0]}-W{dt.isocalendar()[1]:02d}"
    except (ValueError, TypeError):
        return "unknown"


async def _fetch_activities_range(
    athlete_id: str, start_date: str, end_date: str, api_key: str | None
) -> list[dict[str, Any]]:
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/activities",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": 200},
    )
    if isinstance(result, list):
        return [a for a in result if isinstance(a, dict) and a.get("name")]
    return []


async def _fetch_wellness_range(
    athlete_id: str, start_date: str, end_date: str, api_key: str | None
) -> list[dict[str, Any]]:
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/wellness",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date},
    )
    if isinstance(result, list):
        return [w for w in result if isinstance(w, dict)]
    return []


async def _fetch_events_range(
    athlete_id: str, start_date: str, end_date: str, api_key: str | None
) -> list[dict[str, Any]]:
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/events",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date},
    )
    if isinstance(result, list):
        return [e for e in result if isinstance(e, dict)]
    return []


@mcp.tool()
async def get_training_load_summary(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get a computed training load summary (CTL/ATL/TSB trend) for an athlete.

    Returns fitness, fatigue, and form values over the date range, plus weekly
    training stress totals. Useful for understanding if an athlete is building,
    peaking, or recovering.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        start_date: Start date YYYY-MM-DD (optional, defaults to 42 days ago)
        end_date: End date YYYY-MM-DD (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date, default_start_days_ago=42)
    wellness = await _fetch_wellness_range(athlete_id_to_use, start_date, end_date, api_key)

    if not wellness:
        return f"No wellness data found for {athlete_id_to_use} ({start_date} to {end_date})."

    lines = [f"Training Load Summary ({start_date} to {end_date}):"]

    # Latest values
    latest = wellness[-1] if wellness else {}
    ctl = latest.get("ctl")
    atl = latest.get("atl")
    tsb = round(ctl - atl, 1) if ctl is not None and atl is not None else None
    ramp = latest.get("rampRate")

    lines.append("")
    lines.append("Current Status:")
    if ctl is not None:
        lines.append(f"  Fitness (CTL): {ctl}")
    if atl is not None:
        lines.append(f"  Fatigue (ATL): {atl}")
    if tsb is not None:
        label = "Fresh" if tsb > 10 else "Optimal" if tsb > -10 else "Fatigued" if tsb > -25 else "Very Fatigued"
        lines.append(f"  Form (TSB): {tsb} ({label})")
    if ramp is not None:
        lines.append(f"  Ramp Rate: {ramp}")

    # CTL trend (weekly snapshots)
    weekly: dict[str, dict[str, Any]] = {}
    for w in wellness:
        wk = _week_key(w.get("id", ""))
        if wk != "unknown":
            weekly[wk] = {"ctl": w.get("ctl"), "atl": w.get("atl")}

    if weekly:
        lines.append("")
        lines.append("Weekly CTL/ATL Trend:")
        for wk in sorted(weekly.keys())[-6:]:
            vals = weekly[wk]
            c = vals["ctl"]
            a = vals["atl"]
            t = round(c - a, 1) if c is not None and a is not None else None
            parts = []
            if c is not None:
                parts.append(f"CTL:{c}")
            if a is not None:
                parts.append(f"ATL:{a}")
            if t is not None:
                parts.append(f"TSB:{t}")
            lines.append(f"  {wk}: {', '.join(parts)}")

    return "\n".join(lines)


@mcp.tool()
async def get_weekly_training_volume(
    athlete_id: str | None = None,
    api_key: str | None = None,
    weeks: int = 6,
) -> str:
    """Get weekly training volume breakdown (hours, distance, TSS by sport type).

    Shows week-over-week progression useful for monitoring progressive overload
    and recovery weeks. Compares each week to the previous for trend analysis.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        weeks: Number of weeks to analyze (optional, defaults to 6)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(weeks=weeks)).strftime("%Y-%m-%d")
    activities = await _fetch_activities_range(athlete_id_to_use, start_date, end_date, api_key)

    if not activities:
        return f"No activities found for {athlete_id_to_use} in the last {weeks} weeks."

    # Group by week and sport
    weekly_data: dict[str, dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"duration": 0, "distance": 0, "load": 0, "count": 0})
    )

    for act in activities:
        date_str = act.get("start_date_local", act.get("startTime", ""))
        wk = _week_key(date_str)
        sport = act.get("type", "Other")
        w = weekly_data[wk][sport]
        w["duration"] += act.get("moving_time") or act.get("elapsed_time") or 0
        w["distance"] += act.get("distance") or 0
        w["load"] += act.get("icu_training_load") or act.get("trainingLoad") or 0
        w["count"] += 1

    lines = [f"Weekly Training Volume (last {weeks} weeks):"]

    prev_total_load = None
    for wk in sorted(weekly_data.keys()):
        sports = weekly_data[wk]
        total_dur = sum(s["duration"] for s in sports.values())
        total_dist = sum(s["distance"] for s in sports.values())
        total_load = sum(s["load"] for s in sports.values())
        total_count = sum(s["count"] for s in sports.values())

        # Week-over-week change
        change = ""
        if prev_total_load and total_load:
            pct = round((total_load - prev_total_load) / prev_total_load * 100)
            change = f" ({'+' if pct >= 0 else ''}{pct}% load)"
        prev_total_load = total_load

        lines.append("")
        lines.append(f"{wk}: {total_count} activities, {_seconds_to_hms(total_dur)}, {total_dist/1000:.1f}km, Load: {total_load:.0f}{change}")
        for sport, data in sorted(sports.items()):
            lines.append(f"  {sport}: {int(data['count'])}x, {_seconds_to_hms(data['duration'])}, {data['distance']/1000:.1f}km, Load: {data['load']:.0f}")

    return "\n".join(lines)


@mcp.tool()
async def get_zone_distribution(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Get aggregated time-in-zone distribution across activities in a date range.

    Summarizes how much time was spent in each power and HR zone across all
    activities. Useful for assessing polarization and training intensity distribution.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        start_date: Start date YYYY-MM-DD (optional, defaults to 30 days ago)
        end_date: End date YYYY-MM-DD (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date)
    activities = await _fetch_activities_range(athlete_id_to_use, start_date, end_date, api_key)

    if not activities:
        return f"No activities found for {athlete_id_to_use} ({start_date} to {end_date})."

    # Aggregate zone times from activities that have zone data
    power_zones: dict[int, float] = defaultdict(float)
    hr_zones: dict[int, float] = defaultdict(float)
    total_power_time = 0.0
    total_hr_time = 0.0

    for act in activities:
        # Power zone seconds (icu_zone_times is an array indexed by zone)
        pz = act.get("icu_zone_times")
        if isinstance(pz, list):
            for i, secs in enumerate(pz):
                if isinstance(secs, (int, float)) and secs > 0:
                    power_zones[i + 1] += secs
                    total_power_time += secs

        # HR zone seconds
        hz = act.get("icu_hr_zone_times")
        if isinstance(hz, list):
            for i, secs in enumerate(hz):
                if isinstance(secs, (int, float)) and secs > 0:
                    hr_zones[i + 1] += secs
                    total_hr_time += secs

    lines = [f"Zone Distribution ({start_date} to {end_date}, {len(activities)} activities):"]

    if power_zones:
        lines.append("")
        lines.append(f"Power Zones (total: {_seconds_to_hms(total_power_time)}):")
        for z in sorted(power_zones.keys()):
            secs = power_zones[z]
            pct = round(secs / total_power_time * 100, 1) if total_power_time else 0
            bar = "█" * int(pct / 2)
            lines.append(f"  Z{z}: {_seconds_to_hms(secs)} ({pct}%) {bar}")

    if hr_zones:
        lines.append("")
        lines.append(f"HR Zones (total: {_seconds_to_hms(total_hr_time)}):")
        for z in sorted(hr_zones.keys()):
            secs = hr_zones[z]
            pct = round(secs / total_hr_time * 100, 1) if total_hr_time else 0
            bar = "█" * int(pct / 2)
            lines.append(f"  Z{z}: {_seconds_to_hms(secs)} ({pct}%) {bar}")

    # Polarization assessment
    if power_zones and total_power_time:
        easy = sum(power_zones.get(z, 0) for z in [1, 2])
        hard = sum(power_zones.get(z, 0) for z in [5, 6, 7])
        easy_pct = round(easy / total_power_time * 100)
        hard_pct = round(hard / total_power_time * 100)
        lines.append("")
        if easy_pct >= 75 and hard_pct >= 10:
            lines.append(f"Polarization: Good ({easy_pct}% easy, {hard_pct}% hard)")
        elif easy_pct >= 75:
            lines.append(f"Polarization: Mostly easy ({easy_pct}% Z1-2, {hard_pct}% Z5+) — could add more intensity")
        else:
            mid = 100 - easy_pct - hard_pct
            lines.append(f"Polarization: Too much mid-zone ({mid}% Z3-4). Target: 80% easy, 20% hard")

    if not power_zones and not hr_zones:
        lines.append("  No zone data available in activities for this range.")

    return "\n".join(lines)


@mcp.tool()
async def get_readiness_assessment(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get a readiness-to-train assessment based on recent wellness and training data.

    Combines TSB (form), sleep, HRV, resting HR, and subjective scores from the
    last 7 days to produce a readiness summary. Useful for deciding training
    intensity for today.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

    wellness = await _fetch_wellness_range(athlete_id_to_use, start_date, end_date, api_key)

    if not wellness:
        return f"No wellness data found for {athlete_id_to_use} in the last 7 days."

    today = wellness[-1] if wellness else {}
    yesterday = wellness[-2] if len(wellness) >= 2 else {}

    lines = ["Readiness Assessment:"]

    # TSB / Form
    ctl = today.get("ctl")
    atl = today.get("atl")
    if ctl is not None and atl is not None:
        tsb = round(ctl - atl, 1)
        if tsb > 15:
            form_label = "Very Fresh — risk of detraining if prolonged"
        elif tsb > 5:
            form_label = "Fresh — good for key workout or race"
        elif tsb > -10:
            form_label = "Neutral — normal training"
        elif tsb > -25:
            form_label = "Fatigued — consider easy day"
        else:
            form_label = "Very Fatigued — rest recommended"
        lines.append(f"  Form (TSB): {tsb} — {form_label}")
        lines.append(f"  Fitness (CTL): {ctl}, Fatigue (ATL): {atl}")

    # HRV
    hrv = today.get("hrv")
    hrv_yesterday = yesterday.get("hrv")
    if hrv is not None:
        hrv_line = f"  HRV: {hrv}"
        if hrv_yesterday:
            diff = round(hrv - hrv_yesterday, 1)
            hrv_line += f" ({'+' if diff >= 0 else ''}{diff} vs yesterday)"
        lines.append(hrv_line)

    # Resting HR
    rhr = today.get("restingHR")
    rhr_yesterday = yesterday.get("restingHR")
    if rhr is not None:
        rhr_line = f"  Resting HR: {rhr} bpm"
        if rhr_yesterday:
            diff = rhr - rhr_yesterday
            rhr_line += f" ({'+' if diff >= 0 else ''}{diff} vs yesterday)"
        lines.append(rhr_line)

    # Sleep
    sleep_secs = today.get("sleepSecs")
    if sleep_secs is not None:
        hours = round(sleep_secs / 3600, 1)
        quality = today.get("sleepQuality")
        quality_map = {1: "Great", 2: "Good", 3: "Average", 4: "Poor"}
        sleep_line = f"  Sleep: {hours}h"
        if quality:
            sleep_line += f" ({quality_map.get(quality, str(quality))})"
        lines.append(sleep_line)

    # Subjective scores
    subjective = []
    for key, label in [("soreness", "Soreness"), ("fatigue", "Fatigue"), ("stress", "Stress"), ("mood", "Mood"), ("motivation", "Motivation")]:
        val = today.get(key)
        if val is not None:
            subjective.append(f"{label}:{val}/10")
    if subjective:
        lines.append(f"  Subjective: {', '.join(subjective)}")

    # 7-day sleep average
    sleep_vals: list[int | float] = [w["sleepSecs"] for w in wellness if w.get("sleepSecs")]
    if sleep_vals:
        avg_sleep = round(sum(sleep_vals) / len(sleep_vals) / 3600, 1)
        lines.append(f"  7-day Avg Sleep: {avg_sleep}h")

    # Overall readiness signal
    signals = []
    if ctl is not None and atl is not None:
        tsb = ctl - atl
        if tsb < -20:
            signals.append("very_fatigued")
        elif tsb < -10:
            signals.append("fatigued")
    if rhr and rhr_yesterday and rhr - rhr_yesterday > 5:
        signals.append("elevated_rhr")
    if hrv and hrv_yesterday and hrv < hrv_yesterday * 0.8:
        signals.append("low_hrv")
    sleep_quality = today.get("sleepQuality")
    if sleep_quality and sleep_quality >= 4:
        signals.append("poor_sleep")

    lines.append("")
    if "very_fatigued" in signals or len(signals) >= 3:
        lines.append("Recommendation: REST or very easy recovery ride")
    elif "fatigued" in signals or len(signals) >= 2:
        lines.append("Recommendation: Easy endurance ride (Z1-Z2)")
    elif signals:
        lines.append("Recommendation: Moderate training OK, avoid max efforts")
    else:
        lines.append("Recommendation: Good to train — all signals normal")

    return "\n".join(lines)


@mcp.tool()
async def get_planned_vs_actual(
    athlete_id: str | None = None,
    api_key: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> str:
    """Compare planned workouts (events) vs actual activities for a date range.

    For each planned workout, checks if a matching activity exists and compares
    duration, distance, and training load. Useful for tracking workout compliance.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        start_date: Start date YYYY-MM-DD (optional, defaults to 7 days ago)
        end_date: End date YYYY-MM-DD (optional, defaults to today)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    start_date, end_date = resolve_date_params(start_date, end_date, default_start_days_ago=7)

    events = await _fetch_events_range(athlete_id_to_use, start_date, end_date, api_key)
    activities = await _fetch_activities_range(athlete_id_to_use, start_date, end_date, api_key)

    # Only look at planned workouts
    planned = [e for e in events if e.get("category") == "WORKOUT"]
    if not planned:
        return f"No planned workouts found for {athlete_id_to_use} ({start_date} to {end_date})."

    # Index activities by date
    acts_by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for act in activities:
        act_date = (act.get("start_date_local") or act.get("startTime", ""))[:10]
        if act_date:
            acts_by_date[act_date].append(act)

    lines = [f"Planned vs Actual ({start_date} to {end_date}):"]
    completed = 0
    missed = 0

    for event in sorted(planned, key=lambda e: e.get("start_date_local", "")):
        event_date = (event.get("start_date_local") or event.get("date", ""))[:10]
        event_name = event.get("name", "Unnamed")
        event_type = event.get("type", "")
        planned_dur = event.get("moving_time") or event.get("duration")
        planned_load = event.get("icu_training_load") or event.get("load")

        # Find matching activity (same date, similar type)
        day_acts = acts_by_date.get(event_date, [])
        match = None
        for act in day_acts:
            act_type = act.get("type", "")
            if act_type.lower() == event_type.lower() or not event_type:
                match = act
                break
        if not match and day_acts:
            match = day_acts[0]

        if match:
            completed += 1
            actual_dur = match.get("moving_time") or match.get("elapsed_time")
            actual_load = match.get("icu_training_load") or match.get("trainingLoad")

            line = f"  ✓ {event_date} {event_name}"
            comparisons = []
            if planned_dur and actual_dur:
                dur_pct = round(actual_dur / planned_dur * 100)
                comparisons.append(f"duration: {_seconds_to_hms(actual_dur)}/{_seconds_to_hms(planned_dur)} ({dur_pct}%)")
            if planned_load and actual_load:
                load_pct = round(actual_load / planned_load * 100)
                comparisons.append(f"load: {actual_load:.0f}/{planned_load:.0f} ({load_pct}%)")
            if comparisons:
                line += f" — {', '.join(comparisons)}"
            lines.append(line)
        else:
            missed += 1
            lines.append(f"  ✗ {event_date} {event_name} — MISSED")

    total = completed + missed
    compliance = round(completed / total * 100) if total else 0
    lines.append("")
    lines.append(f"Compliance: {completed}/{total} ({compliance}%)")

    return "\n".join(lines)


@mcp.tool()
async def get_efficiency_trend(
    athlete_id: str | None = None,
    api_key: str | None = None,
    weeks: int = 8,
) -> str:
    """Get power-to-HR efficiency trend over recent weeks.

    Tracks the ratio of average power to average heart rate across activities,
    which indicates aerobic fitness improvements. A rising trend means the
    athlete is producing more power for the same cardiac cost.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        weeks: Number of weeks to analyze (optional, defaults to 8)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(weeks=weeks)).strftime("%Y-%m-%d")
    activities = await _fetch_activities_range(athlete_id_to_use, start_date, end_date, api_key)

    if not activities:
        return f"No activities found for {athlete_id_to_use} in the last {weeks} weeks."

    # Group by week, compute avg power:HR
    weekly: dict[str, list[float]] = defaultdict(list)
    weekly_ef: dict[str, list[float]] = defaultdict(list)
    weekly_decouple: dict[str, list[float]] = defaultdict(list)

    for act in activities:
        date_str = act.get("start_date_local", act.get("startTime", ""))
        wk = _week_key(date_str)
        avg_power = act.get("icu_average_watts") or act.get("average_watts")
        avg_hr = act.get("average_heartrate") or act.get("avgHr")
        ef = act.get("icu_efficiency_factor")
        dc = act.get("decoupling")

        if avg_power and avg_hr and avg_hr > 0:
            weekly[wk].append(round(avg_power / avg_hr, 2))
        if ef:
            weekly_ef[wk].append(ef)
        if dc is not None:
            weekly_decouple[wk].append(dc)

    lines = [f"Efficiency Trend (last {weeks} weeks):"]

    sorted_weeks = sorted(weekly.keys())
    if not sorted_weeks:
        return f"No activities with both power and HR data found in the last {weeks} weeks."

    prev_ratio = None
    for wk in sorted_weeks:
        ratios = weekly[wk]
        avg_ratio = round(sum(ratios) / len(ratios), 3)
        n = len(ratios)
        change = ""
        if prev_ratio:
            diff = round((avg_ratio - prev_ratio) / prev_ratio * 100, 1)
            change = f" ({'+' if diff >= 0 else ''}{diff}%)"
        prev_ratio = avg_ratio

        line = f"  {wk}: Power:HR={avg_ratio} (n={n}){change}"

        # Append EF if available
        efs = weekly_ef.get(wk, [])
        if efs:
            avg_ef = round(sum(efs) / len(efs), 2)
            line += f", EF={avg_ef}"

        # Append decoupling if available
        dcs = weekly_decouple.get(wk, [])
        if dcs:
            avg_dc = round(sum(dcs) / len(dcs), 1)
            line += f", Decouple={avg_dc}%"

        lines.append(line)

    # Overall trend
    first_vals = weekly.get(sorted_weeks[0], [])
    last_vals = weekly.get(sorted_weeks[-1], [])
    if first_vals and last_vals:
        first_avg = sum(first_vals) / len(first_vals)
        last_avg = sum(last_vals) / len(last_vals)
        overall = round((last_avg - first_avg) / first_avg * 100, 1)
        lines.append("")
        if overall > 3:
            lines.append(f"Trend: Improving (+{overall}%) — aerobic fitness gaining")
        elif overall < -3:
            lines.append(f"Trend: Declining ({overall}%) — possible overreach or detraining")
        else:
            lines.append(f"Trend: Stable ({'+' if overall >= 0 else ''}{overall}%)")

    return "\n".join(lines)


@mcp.tool()
async def get_power_profile_assessment(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get a power profile assessment comparing recent power bests to season bests.

    Analyzes peak power at key durations (5s, 1min, 5min, 20min, 60min) from
    the last 28 days vs the last 90 days to identify strengths and areas needing work.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    now = datetime.now()
    recent_start = (now - timedelta(days=28)).strftime("%Y-%m-%d")
    season_start = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    # Fetch power curves for both periods
    recent_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        api_key=api_key,
        params={"oldest": recent_start, "newest": end_date},
    )
    season_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        api_key=api_key,
        params={"oldest": season_start, "newest": end_date},
    )

    if isinstance(recent_result, dict) and "error" in recent_result:
        return f"Error fetching power curves: {recent_result.get('message')}"

    # Try to extract key durations from curve data
    key_durations = {"5s": 5, "1min": 60, "5min": 300, "20min": 1200, "60min": 3600}

    def extract_power_at(data: Any, secs: int) -> int | None:
        if isinstance(data, list):
            # Array format — index = seconds
            if secs < len(data) and data[secs] is not None:
                return int(data[secs])
            # Dict-in-list format
            for entry in data:
                if isinstance(entry, dict) and entry.get("secs") == secs:
                    raw = entry.get("value", entry.get("watts", 0))
                    return int(raw) if raw is not None else 0
        return None

    lines = ["Power Profile Assessment:"]
    lines.append("  Recent: last 28 days | Season: last 90 days")
    lines.append("")

    has_data = False
    for label, secs in key_durations.items():
        recent_w = extract_power_at(recent_result, secs)
        season_w = extract_power_at(season_result, secs)
        if recent_w or season_w:
            has_data = True
            parts = [f"  {label}:"]
            if recent_w:
                parts.append(f"Recent={recent_w}W")
            if season_w:
                parts.append(f"Season={season_w}W")
            if recent_w and season_w:
                pct = round(recent_w / season_w * 100)
                if pct >= 95:
                    parts.append("(at peak)")
                elif pct >= 85:
                    parts.append(f"({pct}% of peak)")
                else:
                    parts.append(f"({pct}% of peak — below form)")
            lines.append(" | ".join(parts))

    if not has_data:
        lines.append("  No power curve data available.")

    # Weight for W/kg
    athlete_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}", api_key=api_key
    )
    weight = None
    if isinstance(athlete_result, dict):
        weight = athlete_result.get("weight")
    if weight and has_data:
        lines.append("")
        lines.append(f"  Weight: {weight}kg")
        for label, secs in key_durations.items():
            recent_w = extract_power_at(recent_result, secs)
            if recent_w:
                wkg = round(recent_w / weight, 2)
                lines.append(f"  {label}: {wkg} W/kg")

    return "\n".join(lines)
