"""Wellness journal sync — fetches from Intervals.icu, computes recovery score, writes to Supabase."""

import logging
from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.supabase_client import get_supabase, supabase_upsert

logger = logging.getLogger("intervals_icu_mcp_server")


def compute_recovery_score(
    tsb: float | None,
    hrv: float | None,
    hrv_baseline_28d: float | None,
    resting_hr: int | None,
    rhr_baseline_28d: float | None,
    sleep_secs: int | None,
    fatigue_subjective: int | None,
) -> float | None:
    """Weighted composite recovery score (0-100). Returns None if < 2 components."""
    components: list[float] = []
    weights: list[float] = []

    if tsb is not None:
        components.append(max(0, min(100, (tsb + 30) * 2)))
        weights.append(0.30)

    if hrv and hrv_baseline_28d and hrv_baseline_28d > 0:
        z = (hrv - hrv_baseline_28d) / (hrv_baseline_28d * 0.15)
        components.append(max(0, min(100, 50 + z * 25)))
        weights.append(0.25)

    if resting_hr and rhr_baseline_28d and rhr_baseline_28d > 0:
        z = (resting_hr - rhr_baseline_28d) / (rhr_baseline_28d * 0.08)
        components.append(max(0, min(100, 50 - z * 25)))
        weights.append(0.15)

    if sleep_secs is not None:
        components.append(max(0, min(100, (sleep_secs / 3600 - 4) * 20)))
        weights.append(0.20)

    if fatigue_subjective is not None:
        components.append((fatigue_subjective - 1) * 25)
        weights.append(0.10)

    if len(components) < 2:
        return None

    total_weight = sum(weights)
    return round(sum(c * w for c, w in zip(components, weights)) / total_weight, 1)


def _get_baselines(athlete_id: str, before_date: str) -> tuple[float | None, float | None]:
    """Get 28-day HRV and RHR baselines from wellness_journal."""
    client = get_supabase()
    if client is None:
        return None, None

    try:
        cutoff = (datetime.strptime(before_date, "%Y-%m-%d") - timedelta(days=28)).strftime("%Y-%m-%d")
        result = (
            client.table("wellness_journal")
            .select("hrv, resting_hr")
            .eq("athlete_id", athlete_id)
            .gte("date", cutoff)
            .lt("date", before_date)
            .execute()
        )
        rows = result.data or []
        if len(rows) < 14:
            return None, None

        hrv_vals = [r["hrv"] for r in rows if r.get("hrv") is not None]
        rhr_vals = [r["resting_hr"] for r in rows if r.get("resting_hr") is not None]

        hrv_baseline = sum(hrv_vals) / len(hrv_vals) if hrv_vals else None
        rhr_baseline = sum(rhr_vals) / len(rhr_vals) if rhr_vals else None
        return hrv_baseline, rhr_baseline
    except Exception as e:
        logger.warning("Failed to get baselines: %s", e)
        return None, None


def _wellness_to_row(wellness: dict[str, Any], athlete_id: str, hrv_baseline: float | None, rhr_baseline: float | None) -> dict[str, Any]:
    """Convert an Intervals.icu wellness dict to a wellness_journal row."""
    date = wellness.get("id", wellness.get("date", ""))
    ctl = wellness.get("ctl")
    atl = wellness.get("atl")
    tsb = round(ctl - atl, 1) if ctl is not None and atl is not None else None
    hrv = wellness.get("hrv")
    resting_hr = wellness.get("restingHR")
    sleep_secs = wellness.get("sleepSecs")
    weight = wellness.get("weight")
    fatigue = wellness.get("fatigue")
    mood = wellness.get("mood")
    soreness = wellness.get("soreness")
    stress = wellness.get("stress")

    recovery = compute_recovery_score(
        tsb=tsb,
        hrv=hrv,
        hrv_baseline_28d=hrv_baseline,
        resting_hr=resting_hr,
        rhr_baseline_28d=rhr_baseline,
        sleep_secs=sleep_secs,
        fatigue_subjective=fatigue,
    )

    row: dict[str, Any] = {
        "athlete_id": athlete_id,
        "date": date,
        "ctl": ctl,
        "atl": atl,
        "tsb": tsb,
        "hrv": hrv,
        "resting_hr": resting_hr,
        "sleep_secs": sleep_secs,
        "weight": weight,
        "fatigue": fatigue,
        "mood": mood,
        "soreness": soreness,
        "stress": stress,
        "recovery_score": recovery,
        "updated_at": datetime.now().isoformat(),
    }

    # Custom fields — anything not in the standard set
    _standard_keys = {
        "id", "date", "ctl", "atl", "rampRate", "hrv", "restingHR", "sleepSecs",
        "sleepScore", "sleepQuality", "weight", "fatigue", "mood", "soreness",
        "stress", "motivation", "injury", "spO2", "readiness",
        "baevsky", "vo2max", "updated", "locked",
    }
    custom = {k: v for k, v in wellness.items() if k not in _standard_keys and v is not None}
    if custom:
        row["custom_fields"] = custom

    return row


async def sync_wellness_today() -> str:
    """Sync today's wellness to Supabase. Returns status message."""
    client = get_supabase()
    if client is None:
        return "Supabase not configured — skipping wellness sync."

    config = get_config()
    athlete_id = config.athlete_id
    today = datetime.now().strftime("%Y-%m-%d")

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/wellness/{today}",
    )

    if isinstance(result, dict) and result.get("error"):
        return f"Failed to fetch wellness for {today}: {result.get('message')}"

    if not isinstance(result, dict) or not result.get("id"):
        return f"No wellness data available for {today}."

    hrv_baseline, rhr_baseline = _get_baselines(athlete_id, today)
    row = _wellness_to_row(result, athlete_id, hrv_baseline, rhr_baseline)
    success = supabase_upsert("wellness_journal", row, on_conflict="athlete_id,date")

    if success:
        score_str = f", recovery_score={row['recovery_score']}" if row.get("recovery_score") else ""
        return f"Synced wellness for {today}{score_str}."
    return f"Failed to write wellness for {today} to Supabase."


async def backfill_wellness(days: int = 90) -> str:
    """Backfill wellness_journal with historical data. Runs only if table has < 7 rows."""
    client = get_supabase()
    if client is None:
        return "Supabase not configured."

    config = get_config()
    athlete_id = config.athlete_id

    try:
        count_result = (
            client.table("wellness_journal")
            .select("id", count="exact")
            .eq("athlete_id", athlete_id)
            .execute()
        )
        existing_count = count_result.count if count_result.count is not None else len(count_result.data or [])
        if existing_count >= 7:
            return f"Backfill skipped — already have {existing_count} rows."
    except Exception as e:
        logger.warning("Failed to check wellness_journal count: %s", e)
        return f"Failed to check existing data: {e}"

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/wellness",
        params={"oldest": start_date, "newest": end_date},
    )

    if not isinstance(result, list):
        return "Failed to fetch historical wellness data."

    wellness_data = [w for w in result if isinstance(w, dict) and w.get("id")]
    if not wellness_data:
        return "No historical wellness data found."

    inserted = 0
    for w in wellness_data:
        row = _wellness_to_row(w, athlete_id, None, None)
        if supabase_upsert("wellness_journal", row, on_conflict="athlete_id,date"):
            inserted += 1

    # Now recompute recovery scores with actual baselines
    recomputed = 0
    for w in wellness_data:
        date = w.get("id", w.get("date", ""))
        hrv_baseline, rhr_baseline = _get_baselines(athlete_id, date)
        if hrv_baseline is None and rhr_baseline is None:
            continue
        ctl = w.get("ctl")
        atl = w.get("atl")
        tsb = round(ctl - atl, 1) if ctl is not None and atl is not None else None
        score = compute_recovery_score(
            tsb=tsb,
            hrv=w.get("hrv"),
            hrv_baseline_28d=hrv_baseline,
            resting_hr=w.get("restingHR"),
            rhr_baseline_28d=rhr_baseline,
            sleep_secs=w.get("sleepSecs"),
            fatigue_subjective=w.get("fatigue"),
        )
        if score is not None:
            from intervals_mcp_server.supabase_client import supabase_update
            supabase_update(
                "wellness_journal",
                {"recovery_score": score, "updated_at": datetime.now().isoformat()},
                {"athlete_id": athlete_id, "date": date},
            )
            recomputed += 1

    return f"Backfilled {inserted} days of wellness data, recomputed {recomputed} recovery scores."
