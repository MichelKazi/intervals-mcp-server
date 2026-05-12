"""Convert TrainerRoad workout data to Intervals.icu event format."""

import re

from intervals_mcp_server.trainerroad.models import TRIntervalData, TRWorkoutDetails

TR_SYNC_MARKER = "[TR Sync]"


def _format_duration(secs: int) -> str:
    """Format seconds into a compact duration string (e.g. '5m', '3m30s', '1h5m')."""
    if secs <= 0:
        return "0s"
    h, remainder = divmod(secs, 3600)
    m, s = divmod(remainder, 60)
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    if s:
        parts.append(f"{s}s")
    return "".join(parts) or "0s"


def _strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    return re.sub(r"<[^>]+>", "", text).strip()


def is_tr_synced_event(event: dict) -> bool:
    """Check if an Intervals.icu event was created by the TR sync."""
    desc = event.get("description") or ""
    return desc.startswith(TR_SYNC_MARKER)


def build_structure_text(intervals: list[TRIntervalData]) -> str:
    """Convert TR interval data into Intervals.icu workout structure text.

    Follows the tp2intervals conversion logic:
    - Skip the first interval named "Workout" (it's the overall summary)
    - Rename "Fake" intervals to "Step"
    - Each step: `- {name} {duration} {power}%`
    """
    lines: list[str] = []
    skipped_summary = False

    for interval in intervals:
        if not skipped_summary and interval.name == "Workout":
            skipped_summary = True
            continue

        name = interval.display_name
        duration = _format_duration(interval.duration_secs)
        power = interval.start_target_power_percent
        lines.append(f"- {name} {duration} {power}%")

    return "\n".join(lines)


def _build_description(workout: TRWorkoutDetails) -> str:
    """Build the event description with TR Sync marker."""
    parts = [TR_SYNC_MARKER]
    clean_desc = _strip_html(workout.description)
    if clean_desc:
        parts.append(clean_desc)

    structure = build_structure_text(workout.intervals)
    if structure:
        parts.append(structure)

    return "\n- - - -\n".join(parts)


def workout_to_intervals_event(
    workout: TRWorkoutDetails,
    event_date: str,
) -> dict:
    """Convert a TR workout into an Intervals.icu event creation payload."""
    return {
        "start_date_local": f"{event_date}T00:00:00",
        "name": workout.name,
        "type": workout.sport_type,
        "category": "WORKOUT",
        "moving_time": workout.duration_secs,
        "icu_training_load": workout.tss,
        "description": _build_description(workout),
    }


def plain_event_payload(
    name: str,
    event_date: str,
    duration_secs: int = 0,
    tss: float = 0,
) -> dict:
    """Build a minimal Intervals.icu event payload for workouts without interval data."""
    return {
        "start_date_local": f"{event_date}T00:00:00",
        "name": name,
        "type": "Ride",
        "category": "WORKOUT",
        "moving_time": duration_secs,
        "icu_training_load": tss,
        "description": TR_SYNC_MARKER,
    }


def format_tr_calendar_compact(
    activities: list,
    details_map: dict[str, TRWorkoutDetails] | None = None,
) -> str:
    """Format TR calendar activities into a compact string for LLM consumption."""
    if not activities:
        return "No planned workouts found in the specified date range."

    lines = ["TrainerRoad Calendar:"]
    for act in activities:
        if act.is_completed:
            continue

        name = act.workout_name or "Unnamed"
        parts = [f"  {act.date} — {name}"]
        if act.tss:
            parts.append(f"TSS:{act.tss:.0f}")
        if act.duration_secs:
            h, m = divmod(act.duration_secs // 60, 60)
            if h:
                parts.append(f"{h}h{m:02d}m")
            else:
                parts.append(f"{m}m")

        if details_map and act.activity_id and act.activity_id in details_map:
            wd = details_map[act.activity_id]
            structure = build_structure_text(wd.intervals)
            if structure:
                step_count = structure.count("\n") + 1
                parts.append(f"({step_count} steps)")

        lines.append(" ".join(parts))

    if len(lines) == 1:
        return "No upcoming (unfinished) workouts in the specified date range."
    return "\n".join(lines)
