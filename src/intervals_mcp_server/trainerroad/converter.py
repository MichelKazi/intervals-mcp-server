"""Convert TrainerRoad workout data to Intervals.icu event format."""

from __future__ import annotations

import re

from intervals_mcp_server.trainerroad.models import (
    TRCalendarActivity,
    TRIntervalData,
    TRWorkoutDetails,
)

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


WARMUP_POWER_THRESHOLD = 65
COOLDOWN_POWER_THRESHOLD = 65


def _is_warmup_interval(interval: TRIntervalData, index: int, total: int) -> bool:
    """Heuristic: first non-summary interval at low power is a warmup."""
    if index != 0:
        return False
    return interval.start_target_power_percent <= WARMUP_POWER_THRESHOLD


def _is_cooldown_interval(interval: TRIntervalData, index: int, total: int) -> bool:
    """Heuristic: last interval at low power is a cooldown."""
    if index != total - 1:
        return False
    return interval.start_target_power_percent <= COOLDOWN_POWER_THRESHOLD


def build_workout_doc(intervals: list[TRIntervalData], description: str = "") -> dict:
    """Build an intervals.icu workout_doc from TR interval data.

    Returns a dict matching the intervals.icu WorkoutDoc schema with structured
    power/duration steps. Warmup and cooldown are detected by position + power threshold.
    """
    work_intervals = [iv for iv in intervals if iv.name != "Workout"]
    if not work_intervals:
        return {}

    steps: list[dict] = []
    total = len(work_intervals)

    for i, iv in enumerate(work_intervals):
        step: dict = {
            "duration": iv.duration_secs,
            "power": {"value": iv.start_target_power_percent, "units": "%ftp"},
            "text": iv.display_name,
        }

        if _is_warmup_interval(iv, i, total):
            step["warmup"] = True
        elif _is_cooldown_interval(iv, i, total):
            step["cooldown"] = True

        steps.append(step)

    doc: dict = {"steps": steps}
    clean_desc = _strip_html(description)
    if clean_desc:
        doc["description"] = clean_desc
    return doc


def build_strength_workout_doc(activity: TRCalendarActivity) -> dict:
    """Build a text-based workout_doc for a strength session.

    TR doesn't store structured exercise data for strength, so we create
    text-only steps from the name and notes.
    """
    steps: list[dict] = []

    name = activity.workout_name or "Strength"
    steps.append({"text": name})

    if activity.notes:
        for line in activity.notes.strip().splitlines():
            line = line.strip()
            if line:
                steps.append({"text": line})

    return {"steps": steps}


def workout_to_intervals_event(
    workout: TRWorkoutDetails,
    event_date: str,
    activity: TRCalendarActivity | None = None,
) -> dict:
    """Convert a TR workout into an Intervals.icu event creation payload.

    When interval data is available, builds a structured workout_doc with
    power/duration steps for the intervals.icu calendar.
    """
    payload: dict = {
        "start_date_local": f"{event_date}T00:00:00",
        "name": workout.name,
        "type": workout.sport_type,
        "category": "WORKOUT",
        "moving_time": workout.duration_secs,
        "icu_training_load": workout.tss,
        "description": _build_description(workout),
    }

    if workout.intervals:
        doc = build_workout_doc(workout.intervals, workout.description)
        if doc:
            payload["workout_doc"] = doc

    if activity and activity.is_race:
        payload["category"] = "RACE"
        payload["race"] = True

    return payload


def strength_event_payload(activity: TRCalendarActivity) -> dict:
    """Build an Intervals.icu event payload for a strength session."""
    doc = build_strength_workout_doc(activity)
    return {
        "start_date_local": f"{activity.date}T00:00:00",
        "name": activity.workout_name or "Strength",
        "type": "WeightTraining",
        "category": "WORKOUT",
        "moving_time": activity.duration_secs or 0,
        "description": TR_SYNC_MARKER,
        "workout_doc": doc,
    }


def race_event_payload(activity: TRCalendarActivity) -> dict:
    """Build an Intervals.icu event payload for a race."""
    priority_label = {1: "A", 2: "B", 3: "C"}.get(activity.race_priority, "")
    desc_parts = [TR_SYNC_MARKER]
    if priority_label:
        desc_parts.append(f"Priority: {priority_label} Race")
    if activity.notes:
        desc_parts.append(activity.notes.strip())

    return {
        "start_date_local": f"{activity.date}T00:00:00",
        "name": activity.workout_name or "Race",
        "type": activity.intervals_icu_sport,
        "category": "RACE",
        "race": True,
        "moving_time": activity.duration_secs or 0,
        "icu_training_load": activity.tss or 0,
        "description": "\n".join(desc_parts),
    }


def plain_event_payload(
    name: str,
    event_date: str,
    duration_secs: int = 0,
    tss: float = 0,
    activity: TRCalendarActivity | None = None,
) -> dict:
    """Build a minimal Intervals.icu event payload for workouts without interval data."""
    sport = activity.intervals_icu_sport if activity else "Ride"
    payload: dict = {
        "start_date_local": f"{event_date}T00:00:00",
        "name": name,
        "type": sport,
        "category": "WORKOUT",
        "moving_time": duration_secs,
        "icu_training_load": tss,
        "description": TR_SYNC_MARKER,
    }

    if activity and activity.is_race:
        payload["category"] = "RACE"
        payload["race"] = True

    return payload


def format_tr_calendar_compact(
    activities: list,
    details_map: dict[str, TRWorkoutDetails] | None = None,
    plan_info: dict | None = None,
) -> str:
    """Format TR calendar activities into a compact string for LLM consumption."""
    from datetime import datetime

    now = datetime.now()
    lines = [f"TrainerRoad Calendar (as of {now.strftime('%Y-%m-%d %H:%M')}):"]

    if plan_info:
        phase = plan_info.get("PhaseName") or plan_info.get("Block") or plan_info.get("CurrentPhase") or ""
        week = plan_info.get("Week") or plan_info.get("CurrentWeek") or plan_info.get("WeekNumber") or ""
        plan_name = plan_info.get("PlanName") or plan_info.get("Name") or ""
        if phase or week:
            phase_parts = []
            if plan_name:
                phase_parts.append(plan_name)
            if phase:
                phase_parts.append(f"Phase: {phase}")
            if week:
                phase_parts.append(f"Week {week}")
            lines.append(f"  Plan: {' | '.join(phase_parts)}")
            lines.append("")

    if not activities:
        lines.append("No planned workouts found in the specified date range.")
        return "\n".join(lines)

    races = []
    workouts = []

    for act in activities:
        if act.is_completed:
            continue
        if act.is_race:
            races.append(act)
        elif act.workout_name or act.duration_secs:
            workouts.append(act)

    if races:
        lines.append("  Races:")
        for act in races:
            priority_label = {1: "A", 2: "B", 3: "C"}.get(act.race_priority, "?")
            name = act.workout_name or "Race"
            lines.append(f"    {act.date} — [{priority_label} Race] {name}")
        lines.append("")

    if workouts:
        lines.append("  Workouts:")
        for act in workouts:
            name = act.workout_name or "Unnamed"
            parts = [f"    {act.date} — {name}"]
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

    if not races and not workouts:
        lines.append("No upcoming (unfinished) workouts in the specified date range.")
    return "\n".join(lines)
