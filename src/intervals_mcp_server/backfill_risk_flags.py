"""One-time historical risk flag backfill — replays analytics month-by-month.

Computes what flags WOULD have been raised at each point in time over the past year.
Flags are written with source_tool prefixed by "[backfilled]" so they're distinguishable
from real-time detections.

Usage:
    python -m intervals_mcp_server.backfill_risk_flags
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

import polars as pl

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.supabase_client import get_supabase, supabase_upsert

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)

config = get_config()
analytics = TrainingAnalytics()


def _raise_backfilled_flag(
    flag_type: str,
    severity: str,
    context: dict[str, Any],
    source_tool: str,
    detected_at: str,
) -> bool:
    """Write a backfilled risk flag with a specific detection date."""
    row = {
        "athlete_id": config.athlete_id,
        "flag_type": flag_type,
        "severity": severity,
        "context": context,
        "source_tool": f"[backfilled] {source_tool}",
        "detected_at": detected_at,
        "resolved_at": detected_at,  # Backfilled flags are pre-resolved (historical)
    }
    return supabase_upsert("risk_flags", row, on_conflict="athlete_id,flag_type,detected_date")


def _analyze_week_flags(
    daily_load: pl.DataFrame,
    week_end: datetime,
    all_activities: pl.DataFrame,
) -> list[dict[str, Any]]:
    """Analyze a single week and return flags that would have been raised."""
    flags: list[dict[str, Any]] = []
    week_end_str = week_end.strftime("%Y-%m-%d")

    # --- ACWR ---
    up_to = daily_load.filter(pl.col("date") <= pl.lit(week_end.date()))
    if len(up_to) >= 28:
        recent_28 = up_to.tail(28)
        acute = recent_28.tail(7)["daily_load"].sum()
        chronic = recent_28["daily_load"].sum()
        if chronic > 0:
            acwr = acute / (chronic / 4)
            if acwr > 1.5:
                flags.append({"flag_type": "ACWR_SPIKE", "severity": "critical", "context": {
                    "acwr": round(acwr, 2), "acute_load": round(acute), "chronic_load": round(chronic),
                }, "source_tool": "fatigue_risk"})
            elif acwr > 1.3:
                flags.append({"flag_type": "ACWR_SPIKE", "severity": "warning", "context": {
                    "acwr": round(acwr, 2), "acute_load": round(acute), "chronic_load": round(chronic),
                }, "source_tool": "fatigue_risk"})

    # --- Weekly load stats (monotony, ramp, collapse) ---
    activities_up_to = all_activities.filter(pl.col("date") <= pl.lit(week_end.date()))
    if len(activities_up_to) >= 7:
        weekly = (
            activities_up_to.with_columns(pl.col("date").dt.truncate("1w").alias("week"))
            .group_by("week")
            .agg(
                pl.col("load").sum().alias("total_load"),
                pl.col("load").mean().alias("mean_load"),
                pl.col("load").std().alias("std_load"),
            )
            .sort("week")
        )

        if len(weekly) >= 2:
            current_week_load = weekly["total_load"][-1]
            prev_week_load = weekly["total_load"][-2]
            current_mean = weekly["mean_load"][-1]
            current_std = weekly["std_load"][-1]

            # Monotony
            if current_std and current_std > 0:
                monotony = current_mean / current_std
                if monotony > 2.0:
                    flags.append({"flag_type": "HIGH_MONOTONY", "severity": "warning", "context": {
                        "monotony": round(monotony, 2),
                        "week_start": str(weekly["week"][-1])[:10],
                    }, "source_tool": "fatigue_risk"})

            # Ramp rate
            if prev_week_load and prev_week_load > 0:
                increase_pct = ((current_week_load - prev_week_load) / prev_week_load) * 100
                if increase_pct > 30:
                    flags.append({"flag_type": "RAMP_RATE", "severity": "critical", "context": {
                        "current_week_load": round(current_week_load),
                        "prev_week_load": round(prev_week_load),
                        "increase_pct": round(increase_pct, 1),
                    }, "source_tool": "fatigue_risk"})
                elif increase_pct > 20:
                    flags.append({"flag_type": "RAMP_RATE", "severity": "warning", "context": {
                        "current_week_load": round(current_week_load),
                        "prev_week_load": round(prev_week_load),
                        "increase_pct": round(increase_pct, 1),
                    }, "source_tool": "fatigue_risk"})

            # Load collapse
            if len(weekly) >= 5:
                avg_4w = sum(weekly["total_load"][-5:-1].to_list()) / 4
                if avg_4w > 0 and current_week_load < avg_4w * 0.5:
                    flags.append({"flag_type": "LOAD_COLLAPSE", "severity": "warning", "context": {
                        "current_week_load": round(current_week_load),
                        "avg_4w_load": round(avg_4w),
                        "drop_pct": round((1 - current_week_load / avg_4w) * 100, 1),
                    }, "source_tool": "fatigue_risk"})

    return flags


def _analyze_wellness_flags(
    wellness_data: list[dict[str, Any]],
    as_of_date: str,
) -> list[dict[str, Any]]:
    """Analyze wellness at a point in time for HRV/RHR/sleep flags."""
    flags: list[dict[str, Any]] = []

    # Need at least 28 days of data to compute baselines
    relevant = [w for w in wellness_data if w.get("id", w.get("date", "")) <= as_of_date]
    if len(relevant) < 28:
        return flags

    recent_28 = relevant[-28:]
    latest = relevant[-1]

    # HRV suppression
    hrv_vals = [w["hrv"] for w in recent_28 if w.get("hrv") is not None]
    current_hrv = latest.get("hrv")
    if current_hrv is not None and len(hrv_vals) >= 14:
        mean_hrv = sum(hrv_vals) / len(hrv_vals)
        std_hrv = (sum((v - mean_hrv) ** 2 for v in hrv_vals) / len(hrv_vals)) ** 0.5
        if std_hrv > 0:
            z = (current_hrv - mean_hrv) / std_hrv
            if z < -2.5:
                flags.append({"flag_type": "HRV_SUPPRESSION", "severity": "critical", "context": {
                    "hrv": current_hrv, "baseline_28d": round(mean_hrv, 1), "z_score": round(z, 2),
                }, "source_tool": "training_insights"})
            elif z < -1.5:
                flags.append({"flag_type": "HRV_SUPPRESSION", "severity": "warning", "context": {
                    "hrv": current_hrv, "baseline_28d": round(mean_hrv, 1), "z_score": round(z, 2),
                }, "source_tool": "training_insights"})

    # RHR elevated
    rhr_vals = [w["restingHR"] for w in recent_28 if w.get("restingHR") is not None]
    current_rhr = latest.get("restingHR")
    if current_rhr is not None and len(rhr_vals) >= 14:
        mean_rhr = sum(rhr_vals) / len(rhr_vals)
        std_rhr = (sum((v - mean_rhr) ** 2 for v in rhr_vals) / len(rhr_vals)) ** 0.5
        if std_rhr > 0:
            z = (current_rhr - mean_rhr) / std_rhr
            if z > 2.5:
                flags.append({"flag_type": "RHR_ELEVATED", "severity": "critical", "context": {
                    "rhr": current_rhr, "baseline_28d": round(mean_rhr, 1), "z_score": round(z, 2),
                }, "source_tool": "training_insights"})
            elif z > 1.5:
                flags.append({"flag_type": "RHR_ELEVATED", "severity": "warning", "context": {
                    "rhr": current_rhr, "baseline_28d": round(mean_rhr, 1), "z_score": round(z, 2),
                }, "source_tool": "training_insights"})

    # Sleep debt: 3+ consecutive days below 85% of baseline
    sleep_vals = [(w.get("id", w.get("date", "")), w.get("sleepSecs")) for w in recent_28]
    sleep_with_data = [(d, s) for d, s in sleep_vals if s is not None]
    if len(sleep_with_data) >= 14:
        sleep_numbers = [s for _, s in sleep_with_data]
        baseline_sleep = sum(sleep_numbers) / len(sleep_numbers)
        threshold = baseline_sleep * 0.85

        # Check last 7 days for consecutive below-threshold
        last_7_sleep = sleep_with_data[-7:]
        consecutive = 0
        max_consecutive = 0
        for _, s in last_7_sleep:
            if s < threshold:
                consecutive += 1
                max_consecutive = max(max_consecutive, consecutive)
            else:
                consecutive = 0

        if max_consecutive >= 3:
            recent_low = [s for _, s in last_7_sleep[-max_consecutive:]]
            avg_sleep_h = sum(recent_low) / len(recent_low) / 3600
            flags.append({"flag_type": "SLEEP_DEBT", "severity": "warning", "context": {
                "avg_sleep_h": round(avg_sleep_h, 1),
                "baseline_h": round(baseline_sleep / 3600, 1),
                "consecutive_days": max_consecutive,
            }, "source_tool": "training_insights"})

    return flags


def _analyze_drift_regression(
    all_activities: pl.DataFrame,
    as_of_date: datetime,
) -> list[dict[str, Any]]:
    """Check for drift regression at a point in time (needs 8+ weeks of data)."""
    flags: list[dict[str, Any]] = []

    cutoff = as_of_date.date()
    start = (as_of_date - timedelta(weeks=12)).date()
    period = all_activities.filter(
        (pl.col("date") >= pl.lit(start)) & (pl.col("date") <= pl.lit(cutoff))
    )

    aero = period.filter(
        pl.col("decoupling").is_not_null()
        & pl.col("moving_time").is_not_null()
        & (pl.col("moving_time") > 1800)
    ).sort("date")

    if len(aero) < 10:
        return flags

    mid = len(aero) // 2
    first_half_drift = aero[:mid]["decoupling"].mean()
    second_half_drift = aero[mid:]["decoupling"].mean()

    if first_half_drift and second_half_drift and first_half_drift > 0:
        improvement = (first_half_drift - second_half_drift) / first_half_drift * 100
        if improvement < -15:  # Declining = negative improvement
            flags.append({"flag_type": "DRIFT_REGRESSION", "severity": "warning", "context": {
                "recent_avg_drift": round(second_half_drift, 1),
                "prior_avg_drift": round(first_half_drift, 1),
                "regression_pct": round(abs(improvement), 1),
            }, "source_tool": "aerobic_development"})

    return flags


async def backfill_risk_flags(months: int = 12) -> str:
    """Replay analytics month-by-month and generate historical risk flags."""
    client = get_supabase()
    if client is None:
        return "Supabase not configured."

    athlete_id = config.athlete_id
    end_date = datetime.now()
    start_date = end_date - timedelta(days=months * 30 + 56)  # Extra 8 weeks for ACWR baseline

    # Fetch all activities for the period
    logger.info("Fetching activities for backfill...")
    act_result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/activities",
        params={
            "oldest": start_date.strftime("%Y-%m-%d"),
            "newest": end_date.strftime("%Y-%m-%d"),
            "limit": 2000,
        },
    )

    activities = [a for a in (act_result if isinstance(act_result, list) else []) if isinstance(a, dict) and a.get("name")]
    if not activities:
        return "No activities found for backfill period."

    # Fetch all wellness
    logger.info("Fetching wellness for backfill...")
    well_result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/wellness",
        params={
            "oldest": start_date.strftime("%Y-%m-%d"),
            "newest": end_date.strftime("%Y-%m-%d"),
        },
    )
    wellness_data = [w for w in (well_result if isinstance(well_result, list) else []) if isinstance(w, dict)]

    logger.info("Loaded %d activities, %d wellness records", len(activities), len(wellness_data))

    # Build full activities frame
    af = analytics.activities_frame(activities)

    # Build daily load series (for ACWR)
    daily_load = (
        af.group_by("date")
        .agg(pl.col("load").sum().alias("daily_load"))
        .sort("date")
    )
    # Fill missing dates
    if len(daily_load) > 1:
        date_range = pl.date_range(
            daily_load["date"].min(), daily_load["date"].max(), eager=True
        ).alias("date")
        full_range = pl.DataFrame({"date": date_range})
        daily_load = full_range.join(daily_load, on="date", how="left").with_columns(
            pl.col("daily_load").fill_null(0)
        )

    # Walk week-by-week starting from 8 weeks after start (need baseline)
    analysis_start = start_date + timedelta(weeks=8)
    current = analysis_start
    total_flags = 0
    flags_by_type: dict[str, int] = {}

    while current <= end_date:
        week_end = current
        week_end_str = week_end.strftime("%Y-%m-%dT23:59:59")

        # Activity-based flags (ACWR, monotony, ramp, collapse)
        week_flags = _analyze_week_flags(daily_load, week_end, af)

        # Wellness-based flags (HRV, RHR, sleep)
        date_str = week_end.strftime("%Y-%m-%d")
        well_flags = _analyze_wellness_flags(wellness_data, date_str)

        # Drift regression (monthly, not weekly)
        drift_flags = []
        if current.day <= 7:  # Only check drift at start of month
            drift_flags = _analyze_drift_regression(af, week_end)

        all_flags = week_flags + well_flags + drift_flags

        for flag in all_flags:
            success = _raise_backfilled_flag(
                flag_type=flag["flag_type"],
                severity=flag["severity"],
                context=flag["context"],
                source_tool=flag["source_tool"],
                detected_at=week_end_str,
            )
            if success:
                total_flags += 1
                flags_by_type[flag["flag_type"]] = flags_by_type.get(flag["flag_type"], 0) + 1

        current += timedelta(weeks=1)

    summary_parts = [f"{k}: {v}" for k, v in sorted(flags_by_type.items())]
    return f"Backfilled {total_flags} historical risk flags over {months} months. Breakdown: {', '.join(summary_parts)}"


if __name__ == "__main__":
    result = asyncio.run(backfill_risk_flags(months=12))
    print(result)
