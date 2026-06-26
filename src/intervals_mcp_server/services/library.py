"""
Library service: workout library search, lookup, alternatives, and custom workout creation.

All functions are async for route consistency; sync search_library is called inline.
Raises ServiceError on upstream failure.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.supabase_client import get_supabase
from intervals_mcp_server.trainerroad.library import search_library
from intervals_mcp_server.utils.validation import resolve_athlete_id

# Zone → adaptation mapping (shared with the tool)
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

# Zone keywords recognized in name_search for smart zone routing.
# When name_search matches one of these, treat it as a zone_focus filter.
_ZONE_KEYWORDS: dict[str, str] = {
    "threshold": "threshold",
    "vo2max": "vo2max",
    "vo2": "vo2max",
    "sweet spot": "sweet_spot",
    "sweetspot": "sweet_spot",
    "anaerobic": "anaerobic",
    "endurance": "endurance",
    "tempo": "tempo",
    "recovery": "recovery",
}


def _convert_step(step: dict[str, Any]) -> dict[str, Any]:
    """Convert a single simplified step to workout_doc step format."""
    result: dict[str, Any] = {}

    if "reps" in step:
        result["reps"] = step["reps"]
        if "steps" in step:
            result["steps"] = [_convert_step(s) for s in step["steps"]]
        return result

    if "duration" in step:
        result["duration"] = step["duration"]
    if "distance" in step:
        result["distance"] = step["distance"]

    if step.get("warmup"):
        result["warmup"] = True
    if step.get("cooldown"):
        result["cooldown"] = True

    if step.get("ramp") and "power_start" in step and "power_end" in step:
        result["ramp"] = True
        units = step.get("units", "%ftp")
        result["power"] = {"start": step["power_start"], "end": step["power_end"], "units": units}
    elif "power" in step:
        units = step.get("units", "%ftp")
        result["power"] = {"value": step["power"], "units": units}

    if "hr" in step:
        hr_units = step.get("units", "%lthr")
        result["hr"] = {"value": step["hr"], "units": hr_units}

    if "cadence" in step:
        result["cadence"] = {"value": step["cadence"], "units": "cadence"}

    if "text" in step:
        result["text"] = step["text"]

    return result


def _build_workout_doc(steps: list[dict[str, Any]], description: str | None = None) -> dict:
    """Convert simplified step dicts into intervals.icu workout_doc format."""
    doc_steps = [_convert_step(s) for s in steps]
    doc: dict[str, Any] = {"steps": doc_steps}
    if description:
        doc["description"] = description
    return doc


def _alternative_bands(
    ref: dict,
    adjustment: str | None,
    target_zone: str | None,
    max_duration_minutes: int | None,
) -> dict:
    """Compute search bands for find_alternatives / find_workout_alternatives.

    Args:
        ref: Reference workout row from Supabase (must include tss, duration_secs,
             adaptation_target).
        adjustment: One of shorter/longer/easier/harder/similar (defaults to similar).
        target_zone: If provided, overrides zone/adaptation_target.
        max_duration_minutes: Hard cap on duration_max_secs.

    Returns:
        Dict with keys: search_adaptation, duration_min_secs, duration_max_secs,
        tss_min, tss_max, intensity_min, intensity_max.
    """
    ref_tss = ref.get("tss") or 0
    ref_duration = ref.get("duration_secs") or 0
    ref_adaptation = ref.get("adaptation_target")

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

    return {
        "search_adaptation": search_adaptation,
        "duration_min_secs": duration_min_secs,
        "duration_max_secs": duration_max_secs,
        "tss_min": tss_min,
        "tss_max": tss_max,
        "intensity_min": intensity_min,
        "intensity_max": intensity_max,
    }


async def search_library_workouts(
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
) -> list[dict]:
    """Search the TR workout library. Returns list of workout dicts (empty list is valid).

    duration_min_minutes / duration_max_minutes are converted to seconds before forwarding
    to search_library.
    """
    duration_min_secs = duration_min_minutes * 60 if duration_min_minutes is not None else None
    duration_max_secs = duration_max_minutes * 60 if duration_max_minutes is not None else None

    # Smart zone routing: if name_search exactly matches a zone keyword, treat it as a
    # zone_focus filter instead of a name search (workouts are named after places, not zones).
    resolved_zone = zone_focus
    resolved_name_search = name_search
    if name_search and not zone_focus:
        zone_match = _ZONE_KEYWORDS.get(name_search.strip().lower())
        if zone_match:
            resolved_zone = zone_match
            resolved_name_search = None

    return search_library(
        zone_focus=resolved_zone,
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
        name_search=resolved_name_search,
        limit=limit,
    )


async def get_library_workout(tr_workout_id: str) -> dict:
    """Fetch a single workout row from Supabase by tr_workout_id.

    Parses intervals_json string → list if needed.

    Raises:
        ServiceError(503) if Supabase not configured.
        ServiceError(404) if workout not found.
    """
    client = get_supabase()
    if client is None:
        raise ServiceError(503, "Supabase not configured.")

    try:
        result = (
            client.table("tr_workout_library")
            .select("*")
            .eq("tr_workout_id", tr_workout_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise ServiceError(502, f"Supabase error: {e}") from e

    if not result.data:
        raise ServiceError(404, f"Workout {tr_workout_id} not found in library.")

    workout = result.data[0]
    intervals = workout.get("intervals_json")
    if isinstance(intervals, str):
        workout["intervals_json"] = json.loads(intervals)

    return workout


async def find_alternatives(
    tr_workout_id: str,
    adjustment: str | None = None,
    target_zone: str | None = None,
    max_duration_minutes: int | None = None,
    indoor_only: bool | None = None,
    limit: int = 5,
) -> list[dict]:
    """Find alternative workouts relative to a reference workout.

    Fetches the reference workout, computes search bands via _alternative_bands,
    searches the library, excludes the reference, and falls back to looser constraints
    if no results.

    Raises:
        ServiceError(503) if Supabase not configured.
        ServiceError(404) if reference workout not found.
    """
    client = get_supabase()
    if client is None:
        raise ServiceError(503, "Supabase not configured.")

    try:
        ref_result = (
            client.table("tr_workout_library")
            .select(
                "name,duration_secs,tss,zone_focus,adaptation_target,"
                "interval_pattern,intensity_min,intensity_max,interval_count,"
                "work_duration_avg,is_outside,race_specific"
            )
            .eq("tr_workout_id", tr_workout_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        raise ServiceError(502, f"Supabase error: {e}") from e

    if not ref_result.data:
        raise ServiceError(404, f"Workout {tr_workout_id} not found in library.")

    ref = ref_result.data[0]
    bands = _alternative_bands(ref, adjustment, target_zone, max_duration_minutes)

    results = search_library(
        adaptation_target=bands["search_adaptation"],
        duration_min=bands["duration_min_secs"],
        duration_max=bands["duration_max_secs"],
        tss_min=bands["tss_min"],
        tss_max=bands["tss_max"],
        intensity_min=bands["intensity_min"],
        intensity_max=bands["intensity_max"],
        indoor_only=indoor_only,
        limit=limit + 1,
    )

    results = [w for w in results if w.get("tr_workout_id") != tr_workout_id][:limit]

    if not results:
        results = search_library(
            adaptation_target=bands["search_adaptation"],
            duration_max=bands["duration_max_secs"],
            tss_max=bands["tss_max"],
            indoor_only=indoor_only,
            limit=limit + 1,
        )
        results = [w for w in results if w.get("tr_workout_id") != tr_workout_id][:limit]

    return results


async def create_custom_workout_svc(
    name: str,
    workout_type: str,
    steps: list[dict[str, Any]],
    description: str | None = None,
    tags: list[str] | None = None,
    schedule_date: str | None = None,
    athlete_id: str | None = None,
) -> dict:
    """Create a custom workout in the intervals.icu library, optionally scheduling it.

    Returns:
        {"workout_id": str|None, "scheduled": bool, "event_id": str|int|None,
         "schedule_error": str|None}
        schedule_error is non-None only when schedule_date was provided and the
        calendar-event POST failed; workout creation succeeded in that case.

    Raises:
        ServiceError on library-create failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(400, err)

    workout_doc = _build_workout_doc(steps, description)

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
        method="POST",
        data=workout_data,
    )

    if isinstance(result, dict) and result.get("error"):
        status = result.get("status_code", 502)
        message = result.get("message", "Failed to create workout")
        raise ServiceError(int(status), str(message))

    workout_id = result.get("id") if isinstance(result, dict) else None
    event_id = None
    schedule_error: str | None = None

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
            method="POST",
            data=event_data,
        )

        if isinstance(event_result, dict) and not event_result.get("error"):
            event_id = event_result.get("id")
        elif isinstance(event_result, dict) and event_result.get("error"):
            schedule_error = event_result.get("message", "Failed to schedule workout")

    return {
        "workout_id": workout_id,
        "scheduled": event_id is not None,
        "event_id": event_id,
        "schedule_error": schedule_error,
    }
