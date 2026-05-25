"""Fatigue risk (ACWR) MCP tool — acute:chronic workload ratio analysis."""

from datetime import datetime, timedelta

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.coaching_principles import get_annotation
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.risk_flags import raise_risk_flag, resolve_risk_flag
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def get_fatigue_risk(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Use when concerned about overtraining, injury risk, or rapid load increase.

    Computes acute:chronic workload ratio (7-day / 28-day rolling load).
    Risk bands: <0.8 undertrained, 0.8-1.3 sweet spot, 1.3-1.5 caution, >1.5 danger.
    Detects load spikes (single-day jumps > 0.3 ACWR) in the last 7 days.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=56)).strftime("%Y-%m-%d")

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": 500},
    )

    activities = [a for a in (result if isinstance(result, list) else []) if isinstance(a, dict) and a.get("name")]
    if not activities:
        return f"No activities found for {athlete_id_to_use} in the last 8 weeks."

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(activities)
    risk = analytics.fatigue_risk(af)

    if risk["current_acwr"] is None:
        return "Insufficient data to compute ACWR (need at least 14 days of activity history)."

    lines = ["Fatigue Risk Assessment (ACWR):"]
    lines.append("")
    lines.append(f"  Current ACWR: {risk['current_acwr']} ({risk['risk_band'].upper()})")

    if risk.get("acwr_delta_7d") is not None:
        delta = risk["acwr_delta_7d"]
        direction = "rising" if delta > 0.05 else "falling" if delta < -0.05 else "stable"
        lines.append(f"  7-day trend: {delta:+.2f} ({direction})")

    lines.append("")
    lines.append("  Risk bands: <0.8 undertrained | 0.8-1.3 sweet spot | 1.3-1.5 caution | >1.5 danger")

    # Spikes
    if risk.get("spikes"):
        lines.append("")
        lines.append("  Load Spikes (last 7 days):")
        for spike in risk["spikes"]:
            lines.append(f"    {spike['date']}: ACWR jumped +{spike['jump']}")

    # Recent ACWR timeline
    days = risk.get("days", [])
    if days:
        lines.append("")
        lines.append("  Recent ACWR:")
        for d in days[-7:]:
            date_str = str(d["date"])[:10]
            acwr = d["acwr"]
            acute = d["acute_load"]
            chronic = d["chronic_load"]
            if acwr is not None:
                band = "●" if 0.8 <= acwr <= 1.3 else "⚠" if acwr <= 1.5 else "✗"
                lines.append(f"    {date_str}: {acwr:.2f} {band} (acute={acute:.0f}, chronic={chronic:.0f})")

    # Research-backed annotation
    lines.append("")
    band = risk["risk_band"]
    if band in ("danger", "caution"):
        annotation = get_annotation("acwr_injury_risk")
        if annotation:
            lines.append(f"  Research: {annotation}")
    if risk.get("acwr_delta_7d") and risk["acwr_delta_7d"] > 0.2:
        annotation = get_annotation("ramp_rate")
        if annotation:
            lines.append(f"  Research: {annotation}")

    # Recommendation
    lines.append("")
    if band == "danger":
        lines.append("  Recommendation: Significant deload needed. High injury risk from rapid load spike.")
        lines.append("  Action: Reduce volume 30%, maintain frequency. No new intensity for 3-5 days.")
    elif band == "caution":
        lines.append("  Recommendation: Moderate today. Avoid adding volume — consolidate current load.")
        lines.append("  Action: Reduce volume 20%, keep scheduled intensity but fewer intervals.")
    elif band == "undertrained":
        lines.append("  Recommendation: Safe to increase load. Build gradually (≤10% weekly increase).")
    else:
        lines.append("  Recommendation: Training load well managed. Continue as planned.")

    # --- Risk flag writes ---
    _write_fatigue_risk_flags(risk, af, analytics, weeks=8)

    return "\n".join(lines)


def _write_fatigue_risk_flags(risk: dict, af, analytics, weeks: int) -> None:
    """Write/resolve risk flags based on fatigue analysis."""
    acwr = risk.get("current_acwr")
    if acwr is not None:
        if acwr > 1.5:
            days = risk.get("days", [])
            days_in_zone = sum(1 for d in days[-7:] if d.get("acwr") and d["acwr"] > 1.3)
            raise_risk_flag("ACWR_SPIKE", "critical", {
                "acwr": acwr,
                "acute_load": days[-1]["acute_load"] if days else 0,
                "chronic_load": days[-1]["chronic_load"] if days else 0,
                "days_in_zone": days_in_zone,
            }, "get_fatigue_risk")
        elif acwr > 1.3:
            days = risk.get("days", [])
            days_in_zone = sum(1 for d in days[-7:] if d.get("acwr") and d["acwr"] > 1.3)
            raise_risk_flag("ACWR_SPIKE", "warning", {
                "acwr": acwr,
                "acute_load": days[-1]["acute_load"] if days else 0,
                "chronic_load": days[-1]["chronic_load"] if days else 0,
                "days_in_zone": days_in_zone,
            }, "get_fatigue_risk")
        else:
            resolve_risk_flag("ACWR_SPIKE")

    # Load trend flags (monotony, ramp rate, collapse)
    load = analytics.load_trend(af, weeks=weeks)
    load_weeks = load.get("weeks", [])
    if load_weeks:
        latest_week = load_weeks[-1]
        monotony = latest_week.get("monotony")
        if monotony is not None and monotony > 2.0:
            daily_loads = []
            if latest_week.get("mean_load") and latest_week.get("std_load"):
                daily_loads = []  # Can't reconstruct per-day from weekly aggregates
            raise_risk_flag("HIGH_MONOTONY", "warning", {
                "monotony": round(monotony, 2),
                "week_start": str(latest_week.get("week", ""))[:10],
            }, "get_fatigue_risk")
        else:
            resolve_risk_flag("HIGH_MONOTONY")

        if len(load_weeks) >= 2:
            current_load = latest_week.get("total_load") or 0
            prev_load = load_weeks[-2].get("total_load") or 0
            if prev_load > 0:
                increase_pct = ((current_load - prev_load) / prev_load) * 100
                if increase_pct > 30:
                    raise_risk_flag("RAMP_RATE", "critical", {
                        "current_week_load": round(current_load),
                        "prev_week_load": round(prev_load),
                        "increase_pct": round(increase_pct, 1),
                    }, "get_fatigue_risk")
                elif increase_pct > 20:
                    raise_risk_flag("RAMP_RATE", "warning", {
                        "current_week_load": round(current_load),
                        "prev_week_load": round(prev_load),
                        "increase_pct": round(increase_pct, 1),
                    }, "get_fatigue_risk")
                else:
                    resolve_risk_flag("RAMP_RATE")

            # Load collapse: current week < 50% of 4-week average
            if len(load_weeks) >= 4:
                avg_4w = sum(w.get("total_load") or 0 for w in load_weeks[-5:-1]) / 4
                if avg_4w > 0 and current_load < avg_4w * 0.5:
                    raise_risk_flag("LOAD_COLLAPSE", "warning", {
                        "current_week_load": round(current_load),
                        "avg_4w_load": round(avg_4w),
                        "drop_pct": round((1 - current_load / avg_4w) * 100, 1),
                    }, "get_fatigue_risk")
                else:
                    resolve_risk_flag("LOAD_COLLAPSE")
