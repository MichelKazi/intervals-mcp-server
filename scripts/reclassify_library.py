"""Re-classify all workouts in the TR library cache using the current classifier.

Reads intervals_json from each row, runs classify_workout(), and updates the
classification columns. This fixes stale classifications from earlier versions
of the classifier (e.g. endurance-labeled workouts that are structurally anaerobic).

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... uv run python scripts/reclassify_library.py
"""

import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

from intervals_mcp_server.supabase_client import get_supabase
from intervals_mcp_server.trainerroad.classifier import (
    classify_adaptation_target,
    classify_interval_pattern,
    classify_race_specificity,
    classify_tags,
    classify_zones,
    compute_intensity_range,
    compute_work_recovery_durations,
    count_work_intervals,
)
from intervals_mcp_server.trainerroad.models import TRIntervalData, TRWorkoutDetails


def intervals_from_json(raw: str | list) -> list[TRIntervalData]:
    data = json.loads(raw) if isinstance(raw, str) else raw
    return [
        TRIntervalData(
            start=iv["start"],
            end=iv["end"],
            name=iv.get("name", ""),
            is_fake=iv.get("is_fake", False),
            test_interval=iv.get("test_interval", False),
            start_target_power_percent=iv.get("power_pct", 0),
        )
        for iv in data
    ]


def reclassify_row(row: dict) -> dict | None:
    raw = row.get("intervals_json")
    if not raw:
        return None

    intervals = intervals_from_json(raw)
    if not intervals:
        return None

    dur_secs = row.get("duration_secs", 0)
    workout = TRWorkoutDetails(
        workout_id=row["tr_workout_id"],
        name=row.get("name", ""),
        description=row.get("description") or "",
        tss=row.get("tss", 0),
        is_outside=row.get("is_outside", False),
        duration_minutes=dur_secs // 60 if dur_secs else 0,
        intervals=intervals,
    )

    zones = classify_zones(intervals)
    tags = classify_tags(workout)
    intensity_min, intensity_max = compute_intensity_range(intervals)
    interval_count = count_work_intervals(intervals)
    pattern = classify_interval_pattern(intervals, tags)
    adaptation = classify_adaptation_target(zones, tags)
    race_specific = classify_race_specificity(workout, tags, pattern)
    durations = compute_work_recovery_durations(intervals)

    if pattern not in tags:
        tags.append(pattern)
    if race_specific and "race-specific" not in tags:
        tags.append("race-specific")

    return {
        "zone_focus": zones,
        "tags": tags,
        "intensity_min": intensity_min,
        "intensity_max": intensity_max,
        "interval_count": interval_count,
        "adaptation_target": adaptation,
        "interval_pattern": pattern,
        "race_specific": race_specific,
        "work_duration_avg": durations["work_duration_avg"],
        "recovery_duration_avg": durations["recovery_duration_avg"],
    }


def main():
    client = get_supabase()
    if not client:
        logger.error("Supabase not configured.")
        sys.exit(1)

    batch_size = 100
    offset = 0
    updated = 0
    changed = 0
    errors = 0

    while True:
        result = (
            client.table("tr_workout_library")
            .select("tr_workout_id,name,description,duration_secs,tss,is_outside,sport_type,intervals_json,zone_focus,adaptation_target,interval_pattern,race_specific")
            .order("tr_workout_id")
            .range(offset, offset + batch_size - 1)
            .execute()
        )

        rows = result.data
        if not rows:
            break

        for row in rows:
            try:
                new_class = reclassify_row(row)
                if not new_class:
                    continue

                old_zone = row.get("zone_focus", [])
                old_adapt = row.get("adaptation_target", "")
                old_pattern = row.get("interval_pattern", "")
                old_race = row.get("race_specific", False)

                if (new_class["zone_focus"] != old_zone or
                    new_class["adaptation_target"] != old_adapt or
                    new_class["interval_pattern"] != old_pattern or
                    new_class["race_specific"] != old_race):
                    changed += 1

                client.table("tr_workout_library").update(new_class).eq(
                    "tr_workout_id", row["tr_workout_id"]
                ).execute()
                updated += 1
            except Exception as e:
                errors += 1
                logger.warning("Failed on %s: %s", row.get("tr_workout_id"), e)

        offset += batch_size
        logger.info("Processed %d rows (%d changed, %d errors)...", updated, changed, errors)

    logger.info("Done. Updated %d rows, %d changed classification, %d errors.", updated, changed, errors)


if __name__ == "__main__":
    main()
