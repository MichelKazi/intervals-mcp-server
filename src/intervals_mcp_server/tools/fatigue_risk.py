"""Fatigue risk (ACWR) MCP tool — acute:chronic workload ratio analysis."""

from datetime import datetime, timedelta

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
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

    # Recommendation
    lines.append("")
    band = risk["risk_band"]
    if band == "danger":
        lines.append("  Recommendation: Significant deload needed. High injury risk from rapid load spike.")
    elif band == "caution":
        lines.append("  Recommendation: Moderate today. Avoid adding volume — consolidate current load.")
    elif band == "undertrained":
        lines.append("  Recommendation: Safe to increase load. Build gradually (≤10% weekly increase).")
    else:
        lines.append("  Recommendation: Training load well managed. Continue as planned.")

    return "\n".join(lines)
