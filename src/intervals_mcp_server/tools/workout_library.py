"""Workout library tools — search TR workouts and build custom workouts for intervals.icu."""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp
from intervals_mcp_server.trainerroad.library import (
    get_library_stats,
    get_workout_intervals,
    search_library,
)
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_duration(secs: int) -> str:
    h, remainder = divmod(secs, 3600)
    m, s = divmod(remainder, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m"


def _format_search_result(workout: dict) -> str:
    name = workout.get("name", "?")
    dur = _format_duration(workout.get("duration_secs", 0))
    tss = workout.get("tss")
    zones = workout.get("zone_focus", [])
    adaptation = workout.get("adaptation_target", "")
    pattern = workout.get("interval_pattern", "")
    race_spec = workout.get("race_specific", False)
    intensity_min = workout.get("intensity_min", 0)
    intensity_max = workout.get("intensity_max", 0)
    intervals = workout.get("interval_count", 0)
    work_dur = workout.get("work_duration_avg", 0)
    wid = workout.get("tr_workout_id", "?")

    parts = [f"  {name} [{wid}]"]
    meta = f"    {dur} | TSS:{tss:.0f}" if tss else f"    {dur}"
    if adaptation:
        meta += f" | {adaptation}"
    if race_spec:
        meta += " | RACE-SPECIFIC"
    parts.append(meta)

    detail_parts = []
    if zones:
        detail_parts.append(f"Zones: {', '.join(zones)}")
    if pattern:
        detail_parts.append(f"Pattern: {pattern}")
    if detail_parts:
        parts.append(f"    {' | '.join(detail_parts)}")

    if intensity_max:
        intensity_str = f"    {intensity_min}-{intensity_max}% FTP | {intervals} intervals"
        if work_dur:
            intensity_str += f" | ~{work_dur}s work bouts"
        parts.append(intensity_str)

    return "\n".join(parts)


@mcp.tool()
async def search_workout_library(
    zone_focus: str | None = None,
    adaptation_target: str | None = None,
    interval_pattern: str | None = None,
    race_specific: bool | None = None,
    tags: list[str] | None = None,
    duration_min_minutes: int | None = None,
    duration_max_minutes: int | None = None,
    tss_min: float | None = None,
    tss_max: float | None = None,
    intensity_min: int | None = None,
    intensity_max: int | None = None,
    work_duration_min_sec: int | None = None,
    work_duration_max_sec: int | None = None,
    indoor_only: bool | None = None,
    name_search: str | None = None,
    limit: int = 15,
) -> str:
    """Search the TrainerRoad workout library by training purpose, structure, and constraints.

    Designed for coaching queries like "find me a 60-90 min threshold workout" or
    "something like Brasted but shorter" or "crit-specific repeatability work."

    AXIS 1 — Training Purpose:
      zone_focus: recovery | endurance | tempo | sweet-spot | threshold | vo2max | anaerobic | sprint
      adaptation_target: aerobic_base | tempo_endurance | threshold_power | vo2max | anaerobic_capacity | sprint_power | repeatability | recovery
      race_specific: true for workouts mimicking race demands (surges, variable power)

    AXIS 2 — Duration/Volume:
      duration_min_minutes / duration_max_minutes: workout length range
      tss_min / tss_max: training stress score range

    AXIS 3 — Interval Structure:
      interval_pattern: steady_state | over_under | short_intervals | long_intervals | pyramid | descending | ascending | tabata | sprint_repeats | microbursts | progressive | race_simulation
      intensity_min / intensity_max: peak %FTP range (e.g. 105-120 for VO2max)
      work_duration_min_sec / work_duration_max_sec: average work interval length in seconds
      tags: additional structural tags (e.g. ["over-under", "progressive"])

    AXIS 4 — Equipment:
      indoor_only: true to exclude outdoor-only workouts

    Args:
        zone_focus: Primary training zone
        adaptation_target: What physiological adaptation the workout trains
        interval_pattern: Structural pattern of the intervals
        race_specific: Whether workout mimics race demands
        tags: Structural/style tags to filter by
        duration_min_minutes: Minimum workout duration in minutes
        duration_max_minutes: Maximum workout duration in minutes
        tss_min: Minimum TSS
        tss_max: Maximum TSS
        intensity_min: Minimum peak intensity as %FTP
        intensity_max: Maximum peak intensity as %FTP
        work_duration_min_sec: Minimum average work interval duration in seconds
        work_duration_max_sec: Maximum average work interval duration in seconds
        indoor_only: Only indoor/trainer workouts
        name_search: Partial name match (case-insensitive)
        limit: Max results (default 15)
    """
    duration_min_secs = duration_min_minutes * 60 if duration_min_minutes else None
    duration_max_secs = duration_max_minutes * 60 if duration_max_minutes else None

    results = search_library(
        zone_focus=zone_focus,
        adaptation_target=adaptation_target,
        interval_pattern=interval_pattern,
        race_specific=race_specific,
        tags=tags,
        duration_min=duration_min_secs,
        duration_max=duration_max_secs,
        tss_min=tss_min,
        tss_max=tss_max,
        intensity_min=intensity_min,
        intensity_max=intensity_max,
        work_duration_min=work_duration_min_sec,
        work_duration_max=work_duration_max_sec,
        indoor_only=indoor_only,
        name_search=name_search,
        limit=limit,
    )

    if not results:
        stats = get_library_stats()
        total = stats.get("total", 0)
        if total == 0:
            return (
                "Workout library is empty. Run the crawl script first:\n"
                "  python scripts/crawl_tr_library.py"
            )
        filters = []
        if zone_focus:
            filters.append(f"zone={zone_focus}")
        if adaptation_target:
            filters.append(f"adaptation={adaptation_target}")
        if interval_pattern:
            filters.append(f"pattern={interval_pattern}")
        if duration_min_minutes:
            filters.append(f"min={duration_min_minutes}m")
        if duration_max_minutes:
            filters.append(f"max={duration_max_minutes}m")
        if race_specific:
            filters.append("race-specific")
        return f"No workouts match filters ({', '.join(filters)}). Library has {total} workouts."

    stats = get_library_stats()
    lines = [f"Workout Library ({len(results)} results, {stats.get('total', '?')} total cached):\n"]
    for w in results:
        lines.append(_format_search_result(w))
        lines.append("")

    return "\n".join(lines)


@mcp.tool()
async def get_workout_from_library(
    tr_workout_id: str,
) -> str:
    """Get full details of a cached TR workout including its interval structure for scheduling.

    Use this after search_workout_library to get the full structure before scheduling.

    Args:
        tr_workout_id: The TrainerRoad workout ID from search results
    """
    from intervals_mcp_server.supabase_client import get_supabase

    client = get_supabase()
    if client is None:
        return "Supabase not configured."

    try:
        result = (
            client.table("tr_workout_library")
            .select("*")
            .eq("tr_workout_id", tr_workout_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        return f"Error: {e}"

    if not result.data:
        return f"Workout {tr_workout_id} not found in library."

    w = result.data[0]
    lines = [f"Workout: {w['name']} [{tr_workout_id}]"]
    lines.append(f"  Duration: {_format_duration(w['duration_secs'])}")
    if w.get("tss"):
        lines.append(f"  TSS: {w['tss']:.0f}")
    lines.append(f"  Sport: {w.get('sport_type', 'Ride')}")
    if w.get("zone_focus"):
        lines.append(f"  Zone Focus: {', '.join(w['zone_focus'])}")
    if w.get("tags"):
        lines.append(f"  Tags: {', '.join(w['tags'])}")
    if w.get("intensity_min") and w.get("intensity_max"):
        lines.append(f"  Intensity: {w['intensity_min']}-{w['intensity_max']}% FTP")
    if w.get("interval_count"):
        lines.append(f"  Intervals: {w['interval_count']}")
    if w.get("description"):
        desc = w["description"][:300]
        lines.append(f"  Description: {desc}")

    # Show interval structure
    intervals = w.get("intervals_json")
    if intervals:
        if isinstance(intervals, str):
            intervals = json.loads(intervals)
        lines.append("  Structure:")
        for iv in intervals:
            if iv.get("name") == "Workout":
                continue
            name = iv.get("name", "Step")
            if iv.get("is_fake"):
                name = "Step"
            dur_secs = iv.get("end", 0) - iv.get("start", 0)
            power = iv.get("power_pct", 0)
            dur_str = _format_duration(dur_secs)
            lines.append(f"    - {name} {dur_str} {power}%")

    return "\n".join(lines)


@mcp.tool()
async def create_custom_workout(
    name: str,
    workout_type: str,
    steps: list[dict[str, Any]],
    description: str | None = None,
    tags: list[str] | None = None,
    schedule_date: str | None = None,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Create a custom workout in the intervals.icu library, optionally scheduling it.

    Accepts a simple step format that's easy to construct. Each step is a dict with
    power target and duration (or reps for repeat blocks).

    Args:
        name: Workout name (e.g. "VO2max 3x3min")
        workout_type: Sport type (Ride, Run, Swim, VirtualRide)
        steps: List of workout steps. Each step is a dict:
            - Simple: {"power": 95, "duration": 300} (95% FTP for 5min)
            - With units: {"power": 95, "units": "%ftp", "duration": 300}
            - HR target: {"hr": 85, "units": "%lthr", "duration": 600}
            - Warmup: {"power": 60, "duration": 600, "warmup": true}
            - Cooldown: {"power": 50, "duration": 300, "cooldown": true}
            - Ramp: {"power_start": 60, "power_end": 90, "duration": 600, "ramp": true}
            - Repeat: {"reps": 3, "steps": [{"power": 120, "duration": 180}, {"power": 60, "duration": 120}]}
            - Text note: {"text": "High cadence", "power": 95, "duration": 60}
        description: Optional workout description
        tags: Optional tags for the workout library
        schedule_date: Optional YYYY-MM-DD to also schedule this on the calendar
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    # Convert simple step format to intervals.icu workout_doc format
    workout_doc = _build_workout_doc(steps, description)

    # Create in workout library
    workout_data: dict[str, Any] = {
        "name": name,
        "type": workout_type,
        "workout_doc": workout_doc,
    }
    if description:
        workout_data["description"] = description
    if tags:
        workout_data["tags"] = tags

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts",
        api_key=api_key,
        method="POST",
        data=workout_data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating workout: {result.get('message')}"

    workout_id = result.get("id") if isinstance(result, dict) else None
    lines = [f"Created workout '{name}' in library (ID: {workout_id})"]

    # Optionally schedule on calendar
    if schedule_date:
        event_data: dict[str, Any] = {
            "start_date_local": f"{schedule_date}T00:00:00",
            "category": "WORKOUT",
            "name": name,
            "type": workout_type,
            "workout_doc": workout_doc,
        }

        event_result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events",
            api_key=api_key,
            method="POST",
            data=event_data,
        )

        if isinstance(event_result, dict) and "error" in event_result:
            lines.append(f"  Scheduled: FAILED ({event_result.get('message')})")
        else:
            event_id = event_result.get("id") if isinstance(event_result, dict) else "?"
            lines.append(f"  Scheduled on {schedule_date} (event ID: {event_id})")

    return "\n".join(lines)


ZONE_TO_ADAPTATION = {
    "threshold": "threshold_power",
    "vo2max": "vo2max",
    "sweet-spot": "threshold_power",
    "anaerobic": "anaerobic_capacity",
    "endurance": "aerobic_base",
    "tempo": "tempo_endurance",
    "sprint": "sprint_power",
    "recovery": "recovery",
}


@mcp.tool()
async def find_workout_alternatives(
    tr_workout_id: str,
    adjustment: str | None = None,
    target_zone: str | None = None,
    max_duration_minutes: int | None = None,
    indoor_only: bool | None = None,
    limit: int = 5,
) -> str:
    """Find alternative workouts based on a reference workout, applying directional adjustments.

    Takes a workout you've already identified and finds alternatives that shift in a
    specified direction. Useful when the athlete says things like:
    - "I only have 60 minutes" → adjustment="shorter"
    - "I'm feeling great, give me something harder" → adjustment="harder"
    - "Same vibe but with more intervals" → adjustment="similar"
    - "I don't have the legs for VO2max today" → target_zone="sweet-spot"

    Args:
        tr_workout_id: The reference workout ID to pivot from
        adjustment: Direction to shift. Options:
            - "shorter" — same zone/intensity, less time
            - "longer" — same zone/intensity, more time
            - "easier" — same zone, lower TSS/intensity
            - "harder" — same zone, higher TSS/intensity
            - "similar" — same zone, duration, and TSS band (different workout)
            If omitted, defaults to "similar"
        target_zone: Override the zone entirely (e.g. switch from vo2max to sweet-spot).
            Options: threshold, vo2max, sweet-spot, anaerobic, endurance, tempo, sprint, recovery
        max_duration_minutes: Cap the duration of alternatives (e.g. 60 if short on time)
        indoor_only: Only return indoor/trainer workouts
        limit: Number of alternatives to return (default 5)
    """
    from intervals_mcp_server.supabase_client import get_supabase

    client = get_supabase()
    if client is None:
        return "Supabase not configured."

    try:
        ref_result = (
            client.table("tr_workout_library")
            .select("name,duration_secs,tss,zone_focus,adaptation_target,"
                    "interval_pattern,intensity_min,intensity_max,interval_count,"
                    "work_duration_avg,is_outside,race_specific")
            .eq("tr_workout_id", tr_workout_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        return f"Error fetching reference workout: {e}"

    if not ref_result.data:
        return f"Workout {tr_workout_id} not found in library."

    ref = ref_result.data[0]
    ref_tss = ref.get("tss") or 0
    ref_duration = ref.get("duration_secs") or 0
    ref_zones = ref.get("zone_focus") or []
    ref_adaptation = ref.get("adaptation_target")
    ref_intensity_max = ref.get("intensity_max") or 0

    adjustment = adjustment or "similar"

    if target_zone:
        search_adaptation = ZONE_TO_ADAPTATION.get(target_zone, ref_adaptation)
    else:
        search_adaptation = ref_adaptation

    tss_min = None
    tss_max = None
    duration_min_secs = None
    duration_max_secs = None
    intensity_min = None
    intensity_max = None

    if adjustment == "shorter":
        duration_max_secs = int(ref_duration * 0.8)
        duration_min_secs = int(ref_duration * 0.4)
        tss_min = ref_tss * 0.5
        tss_max = ref_tss * 0.9
    elif adjustment == "longer":
        duration_min_secs = int(ref_duration * 1.1)
        duration_max_secs = int(ref_duration * 1.8)
        tss_min = ref_tss * 1.0
        tss_max = ref_tss * 1.8
    elif adjustment == "easier":
        duration_min_secs = int(ref_duration * 0.7)
        duration_max_secs = int(ref_duration * 1.1)
        tss_max = ref_tss * 0.85
        tss_min = ref_tss * 0.4
    elif adjustment == "harder":
        duration_min_secs = int(ref_duration * 0.9)
        duration_max_secs = int(ref_duration * 1.3)
        tss_min = ref_tss * 1.1
        tss_max = ref_tss * 1.8
    else:  # similar
        duration_min_secs = int(ref_duration * 0.85)
        duration_max_secs = int(ref_duration * 1.15)
        tss_min = ref_tss * 0.85
        tss_max = ref_tss * 1.15

    if max_duration_minutes:
        cap = max_duration_minutes * 60
        if duration_max_secs is None or cap < duration_max_secs:
            duration_max_secs = cap
        if duration_min_secs and duration_min_secs > cap:
            duration_min_secs = int(cap * 0.5)

    results = search_library(
        adaptation_target=search_adaptation,
        duration_min=duration_min_secs,
        duration_max=duration_max_secs,
        tss_min=tss_min,
        tss_max=tss_max,
        intensity_min=intensity_min,
        intensity_max=intensity_max,
        indoor_only=indoor_only,
        limit=limit + 1,
    )

    results = [w for w in results if w.get("tr_workout_id") != tr_workout_id][:limit]

    if not results:
        results = search_library(
            adaptation_target=search_adaptation,
            duration_max=duration_max_secs,
            tss_max=tss_max,
            indoor_only=indoor_only,
            limit=limit + 1,
        )
        results = [w for w in results if w.get("tr_workout_id") != tr_workout_id][:limit]

    ref_name = ref.get("name", "?")
    ref_dur_str = _format_duration(ref_duration)
    zone_str = target_zone or (ref_zones[0] if ref_zones else "?")

    lines = [
        f"Alternatives for {ref_name} [{tr_workout_id}] "
        f"({ref_dur_str}, TSS {ref_tss:.0f}, {zone_str})",
        f"Adjustment: {adjustment}"
        + (f" | Zone override: {target_zone}" if target_zone else ""),
        "",
    ]

    if not results:
        lines.append("No alternatives found with these constraints.")
        lines.append("Try widening: remove max_duration_minutes, or use a broader adjustment.")
        return "\n".join(lines)

    for w in results:
        lines.append(_format_search_result(w))
        lines.append("")

    return "\n".join(lines)


def _build_workout_doc(steps: list[dict[str, Any]], description: str | None = None) -> dict:
    """Convert simplified step dicts into intervals.icu workout_doc format."""
    doc_steps = []
    for step in steps:
        doc_steps.append(_convert_step(step))

    doc: dict[str, Any] = {"steps": doc_steps}
    if description:
        doc["description"] = description
    return doc


def _convert_step(step: dict[str, Any]) -> dict[str, Any]:
    """Convert a single simplified step to workout_doc step format."""
    result: dict[str, Any] = {}

    # Repeat block
    if "reps" in step:
        result["reps"] = step["reps"]
        if "steps" in step:
            result["steps"] = [_convert_step(s) for s in step["steps"]]
        return result

    # Duration/distance
    if "duration" in step:
        result["duration"] = step["duration"]
    if "distance" in step:
        result["distance"] = step["distance"]

    # Warmup/cooldown flags
    if step.get("warmup"):
        result["warmup"] = True
    if step.get("cooldown"):
        result["cooldown"] = True

    # Ramp
    if step.get("ramp") and "power_start" in step and "power_end" in step:
        result["ramp"] = True
        units = step.get("units", "%ftp")
        result["power"] = {"start": step["power_start"], "end": step["power_end"], "units": units}
    elif "power" in step:
        units = step.get("units", "%ftp")
        result["power"] = {"value": step["power"], "units": units}

    # HR target
    if "hr" in step:
        hr_units = step.get("units", "%lthr")
        result["hr"] = {"value": step["hr"], "units": hr_units}

    # Cadence
    if "cadence" in step:
        result["cadence"] = {"value": step["cadence"], "units": "cadence"}

    # Text
    if "text" in step:
        result["text"] = step["text"]

    return result
