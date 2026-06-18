"""TrainerRoad workout library — Supabase cache layer for search and auto-backfill."""

import json
import logging
from typing import Any

from intervals_mcp_server.supabase_client import get_supabase
from intervals_mcp_server.trainerroad.classifier import classify_workout
from intervals_mcp_server.trainerroad.models import TRIntervalData, TRWorkoutDetails

logger = logging.getLogger("intervals_icu_mcp_server.tr_library")

TABLE = "tr_workout_library"


def _interval_to_dict(iv: TRIntervalData) -> dict:
    return {
        "start": iv.start,
        "end": iv.end,
        "name": iv.name,
        "is_fake": iv.is_fake,
        "test_interval": iv.test_interval,
        "power_pct": iv.start_target_power_percent,
    }


def upsert_workout(workout: TRWorkoutDetails) -> bool:
    """Upsert a workout into the library cache. Returns True on success."""
    client = get_supabase()
    if client is None:
        return False

    classification = classify_workout(workout)
    intervals_json = [_interval_to_dict(iv) for iv in workout.intervals]

    row = {
        "tr_workout_id": workout.workout_id,
        "name": workout.name,
        "description": workout.description[:2000] if workout.description else None,
        "duration_secs": workout.duration_secs,
        "tss": workout.tss,
        "is_outside": workout.is_outside,
        "sport_type": workout.sport_type,
        "zone_focus": classification["zone_focus"],
        "tags": classification["tags"],
        "intensity_min": classification["intensity_min"],
        "intensity_max": classification["intensity_max"],
        "interval_count": classification["interval_count"],
        "adaptation_target": classification["adaptation_target"],
        "interval_pattern": classification["interval_pattern"],
        "race_specific": classification["race_specific"],
        "work_duration_avg": classification["work_duration_avg"],
        "recovery_duration_avg": classification["recovery_duration_avg"],
        "intervals_json": json.dumps(intervals_json),
        "updated_at": "now()",
    }

    try:
        client.table(TABLE).upsert(row, on_conflict="tr_workout_id").execute()
        return True
    except Exception as e:
        logger.debug("Failed to upsert workout %s: %s", workout.workout_id, e)
        return False


def workout_exists(workout_id: str) -> bool:
    """Check if a workout is already in the cache."""
    client = get_supabase()
    if client is None:
        return False
    try:
        result = (
            client.table(TABLE)
            .select("tr_workout_id")
            .eq("tr_workout_id", workout_id)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception:
        return False


def search_library(
    zone_focus: str | None = None,
    adaptation_target: str | None = None,
    interval_pattern: str | None = None,
    race_specific: bool | None = None,
    tags: list[str] | None = None,
    duration_min: int | None = None,
    duration_max: int | None = None,
    tss_min: float | None = None,
    tss_max: float | None = None,
    intensity_min: int | None = None,
    intensity_max: int | None = None,
    work_duration_min: int | None = None,
    work_duration_max: int | None = None,
    sport_type: str | None = None,
    name_search: str | None = None,
    indoor_only: bool | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search the cached workout library with filters across all classification axes."""
    client = get_supabase()
    if client is None:
        return []

    try:
        query = client.table(TABLE).select(
            "tr_workout_id,name,duration_secs,tss,zone_focus,tags,"
            "intensity_min,intensity_max,interval_count,sport_type,is_outside,"
            "adaptation_target,interval_pattern,race_specific,"
            "work_duration_avg,recovery_duration_avg"
        )

        # Axis 1: Training purpose
        if zone_focus:
            query = query.contains("zone_focus", [zone_focus])
        if adaptation_target:
            query = query.eq("adaptation_target", adaptation_target)
        if interval_pattern:
            query = query.eq("interval_pattern", interval_pattern)
        if race_specific is not None:
            query = query.eq("race_specific", race_specific)

        # Axis 2: Duration/volume
        if duration_min is not None:
            query = query.gte("duration_secs", duration_min)
        if duration_max is not None:
            query = query.lte("duration_secs", duration_max)
        if tss_min is not None:
            query = query.gte("tss", tss_min)
        if tss_max is not None:
            query = query.lte("tss", tss_max)

        # Axis 3: Interval structure
        if intensity_min is not None:
            query = query.gte("intensity_max", intensity_min)
        if intensity_max is not None:
            query = query.lte("intensity_max", intensity_max)
        if work_duration_min is not None:
            query = query.gte("work_duration_avg", work_duration_min)
        if work_duration_max is not None:
            query = query.lte("work_duration_avg", work_duration_max)
        if tags:
            for tag in tags:
                query = query.contains("tags", [tag])

        # Equipment/platform
        if sport_type:
            query = query.eq("sport_type", sport_type)
        if indoor_only:
            query = query.eq("is_outside", False)
        if name_search:
            query = query.ilike("name", f"%{name_search}%")

        query = query.order("tss", desc=False).limit(limit)
        result = query.execute()
        return result.data or []
    except Exception as e:
        logger.debug("Library search failed: %s", e)
        return []


def get_workout_intervals(workout_id: str) -> list[dict] | None:
    """Get the cached interval JSON for a workout (for workout_doc generation)."""
    client = get_supabase()
    if client is None:
        return None
    try:
        result = (
            client.table(TABLE)
            .select("intervals_json")
            .eq("tr_workout_id", workout_id)
            .limit(1)
            .execute()
        )
        if result.data:
            raw = result.data[0].get("intervals_json")
            if isinstance(raw, str):
                return json.loads(raw)
            return raw
        return None
    except Exception:
        return None


def get_library_stats() -> dict[str, Any]:
    """Get summary stats about the cached library."""
    client = get_supabase()
    if client is None:
        return {"total": 0, "error": "Supabase not configured"}
    try:
        result = client.table(TABLE).select("tr_workout_id", count="exact").execute()
        return {"total": result.count or 0}
    except Exception as e:
        return {"total": 0, "error": str(e)}
