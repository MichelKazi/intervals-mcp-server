"""
Analytics service: chartable JSON for the frontend More-tab charts.

Reuses existing services (wellness, activities) and the raw Intervals.icu API
for power curves and zone times. Returns structured data (numbers, not formatted
strings) so the frontend can render charts directly.

Raises ServiceError on upstream failure; tolerates missing / Strava-restricted data.
"""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.activities import list_activities
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.services.wellness import wellness_series
from intervals_mcp_server.utils.validation import resolve_athlete_id

# Standard durations (seconds) surfaced in the power profile.
_PROFILE_DURATIONS = [5, 60, 300, 1200, 3600]


def _check_error(result: Any) -> None:
    """Raise ServiceError if result is an error dict."""
    if isinstance(result, dict) and result.get("error"):
        status = result.get("status_code", 502)
        message = result.get("message", "Upstream error")
        raise ServiceError(status_code=int(status), message=str(message))


def _date_str(days_ago: int) -> str:
    return (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")


def _week_start(date_str: str) -> str | None:
    """Return the ISO Monday of the week containing date_str (YYYY-MM-DD)."""
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None
    monday = dt - timedelta(days=dt.weekday())
    return monday.strftime("%Y-%m-%d")


async def pmc_series(days: int = 90, athlete_id: str | None = None) -> list[dict[str, Any]]:
    """Performance Management Chart points: {date, ctl, atl, tsb, rampRate}.

    Reuses wellness_series and shapes each day into chartable fields. tsb is
    derived as ctl - atl when both are present.

    Args:
        days: Lookback window in days (defaults to 90).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    rows = await wellness_series(oldest=_date_str(days), newest=None, athlete_id=athlete_id)

    series: list[dict[str, Any]] = []
    for w in rows:
        if not isinstance(w, dict):
            continue
        date = w.get("date") or w.get("id")
        ctl = w.get("ctl")
        atl = w.get("atl")
        tsb = round(ctl - atl, 1) if isinstance(ctl, (int, float)) and isinstance(atl, (int, float)) else None
        point: dict[str, Any] = {"date": date, "ctl": ctl, "atl": atl, "tsb": tsb}
        ramp = w.get("rampRate")
        if ramp is not None:
            point["rampRate"] = ramp
        series.append(point)

    series.sort(key=lambda p: p.get("date") or "")
    return series


def _power_at(curve: Any, secs: int) -> dict[str, Any] | None:
    """Extract {secs, watts, date} for a duration from a power-curve response.

    Handles the flat array form (index == seconds) and the list-of-dicts form
    ({secs, value/watts, ...}). Returns None when no data at that duration.
    """
    if isinstance(curve, list) and curve:
        if isinstance(curve[0], (int, float, type(None))):
            if secs < len(curve) and curve[secs] is not None:
                return {"secs": secs, "watts": int(curve[secs]), "date": None}
            return None
        if isinstance(curve[0], dict):
            for entry in curve:
                if entry.get("secs") == secs:
                    raw = entry.get("value", entry.get("watts"))
                    if raw is None:
                        return None
                    return {
                        "secs": secs,
                        "watts": int(raw),
                        "date": entry.get("date") or entry.get("start_date_local"),
                    }
    return None


def _profile_from_curve_object(result: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract standard durations from the athlete power-curves object form.

    The /athlete/{id}/power-curves endpoint returns
    {"list": [{secs: [...], watts: [...], activity_id: [...]}], "activities": {id: {...}}}.
    secs/watts/activity_id are parallel arrays; activities maps an activity id to
    its metadata (used to resolve the date the peak was set).
    """
    curves = result.get("list")
    if not isinstance(curves, list) or not curves:
        return []
    curve = curves[0]
    secs = curve.get("secs")
    watts = curve.get("watts") or curve.get("values")
    if not isinstance(secs, list) or not isinstance(watts, list):
        return []
    activity_ids = curve.get("activity_id")
    activities = result.get("activities") if isinstance(result.get("activities"), dict) else {}

    durations: list[dict[str, Any]] = []
    for target in _PROFILE_DURATIONS:
        if target not in secs:
            continue
        i = secs.index(target)
        if i >= len(watts) or watts[i] is None:
            continue
        date = None
        if isinstance(activity_ids, list) and i < len(activity_ids):
            aid = activity_ids[i]
            meta = activities.get(aid) if isinstance(activities, dict) else None
            if isinstance(meta, dict):
                sdl = meta.get("start_date_local")
                date = sdl[:10] if isinstance(sdl, str) else None
        durations.append({"secs": target, "watts": int(watts[i]), "date": date})
    return durations


async def power_profile(
    sport: str = "Ride",
    days: int = 90,
    athlete_id: str | None = None,
) -> dict[str, Any]:
    """Best power at standard durations: {durations: [{secs, watts, date}]}.

    Pulls the athlete power curve over the window and extracts the standard
    durations (5s, 1m, 5m, 20m, 60m). Durations with no data are omitted.

    Args:
        sport: Activity type filter (default "Ride").
        days: Lookback window in days (defaults to 90).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        params={"oldest": _date_str(days), "newest": _date_str(0), "type": sport},
    )
    _check_error(result)

    # Athlete power-curves returns {"list": [...], "activities": {...}}.
    if isinstance(result, dict):
        return {"durations": _profile_from_curve_object(result)}

    durations: list[dict[str, Any]] = []
    for secs in _PROFILE_DURATIONS:
        point = _power_at(result, secs)
        if point is not None:
            durations.append(point)

    return {"durations": durations}


async def zone_distribution(
    weeks: int = 4,
    athlete_id: str | None = None,
) -> dict[str, Any]:
    """Time-in-zone across the period: {zones: [{zone, seconds, pct}], target: []}.

    Sums icu_zone_times (power zones) across activities in the window. Falls back
    to HR zones when no power-zone data is present. target is left empty (no
    configured model); the frontend can overlay its own.

    Args:
        weeks: Lookback window in weeks (defaults to 4).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    activities = await list_activities(
        oldest=_date_str(weeks * 7),
        newest=None,
        limit=200,
        athlete_id=athlete_id,
    )

    power_zones: dict[int, float] = defaultdict(float)
    hr_zones: dict[int, float] = defaultdict(float)
    for act in activities:
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

    source = power_zones if power_zones else hr_zones
    total = sum(source.values())
    zones = [
        {
            "zone": f"Z{z}",
            "seconds": round(source[z]),
            "pct": round(source[z] / total * 100, 1) if total else 0,
        }
        for z in sorted(source.keys())
    ]
    return {"zones": zones, "target": []}


async def volume_scatter(days: int = 180, athlete_id: str | None = None) -> list[dict[str, Any]]:
    """Per-activity scatter points: [{date, tss, duration_secs, type}].

    Reuses list_activities (already drops Strava-restricted entries). One point
    per accessible activity.

    Args:
        days: Lookback window in days (defaults to 180).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    activities = await list_activities(
        oldest=_date_str(days),
        newest=None,
        limit=500,
        athlete_id=athlete_id,
    )

    points: list[dict[str, Any]] = []
    for act in activities:
        date = (act.get("start_date_local") or act.get("startTime") or "")[:10]
        points.append(
            {
                "date": date or None,
                "tss": act.get("icu_training_load") or act.get("trainingLoad"),
                "duration_secs": act.get("moving_time") or act.get("elapsed_time"),
                "type": act.get("type", "Other"),
            }
        )
    return points


async def weekly_volume(weeks: int = 12, athlete_id: str | None = None) -> list[dict[str, Any]]:
    """Weekly rollup: [{week_start, hours, tss, sessions}].

    Buckets activities into ISO weeks (Monday start) and totals duration, load,
    and session count per week. Sorted ascending by week_start.

    Args:
        weeks: Lookback window in weeks (defaults to 12).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    activities = await list_activities(
        oldest=_date_str(weeks * 7),
        newest=None,
        limit=500,
        athlete_id=athlete_id,
    )

    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {"seconds": 0.0, "tss": 0.0, "sessions": 0.0})
    for act in activities:
        date = act.get("start_date_local") or act.get("startTime") or ""
        wk = _week_start(date)
        if wk is None:
            continue
        b = buckets[wk]
        b["seconds"] += act.get("moving_time") or act.get("elapsed_time") or 0
        b["tss"] += act.get("icu_training_load") or act.get("trainingLoad") or 0
        b["sessions"] += 1

    return [
        {
            "week_start": wk,
            "hours": round(buckets[wk]["seconds"] / 3600, 2),
            "tss": round(buckets[wk]["tss"]),
            "sessions": int(buckets[wk]["sessions"]),
        }
        for wk in sorted(buckets.keys())
    ]
