"""Aerobic development MCP tool — cardiac drift and base fitness analysis."""

from datetime import datetime, timedelta

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _seconds_to_hms(secs: int | float | None) -> str:
    if not secs:
        return "0:00"
    s = int(secs)
    h, m = divmod(s, 3600)
    m, sec = divmod(m, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{sec:02d}s"


@mcp.tool()
async def get_aerobic_development(
    athlete_id: str | None = None,
    api_key: str | None = None,
    weeks: int = 12,
) -> str:
    """Analyze cardiac drift patterns to assess aerobic base development.

    Shows how heart rate decouples from power/pace at different durations,
    identifies your "drift threshold" (where HR drift becomes problematic),
    tracks whether it's improving over time, flags rides with concerning
    drift at low intensity, and correlates pacing consistency with drift.

    Key insight: if drift is improving at longer durations, your aerobic base
    is developing well. If you're drifting >5% on easy Z2 rides, base fitness
    needs more work.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        weeks: Lookback period in weeks (optional, defaults to 12)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": 500},
    )

    activities = [a for a in (result if isinstance(result, list) else []) if isinstance(a, dict) and a.get("name")]
    if not activities:
        return f"No activities found for {athlete_id_to_use} in the last {weeks} weeks."

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(activities)
    dev = analytics.aerobic_development(af)

    if dev["status"] == "insufficient data":
        return (
            f"Insufficient decoupling data ({dev['activities_with_drift']} activities with drift data). "
            "Need at least 5 rides/runs over 30 minutes with HR data."
        )

    lines = [f"Aerobic Development Analysis ({weeks}-week lookback, {dev['activities_analyzed']} activities):"]

    # Duration vs drift table
    duration_drift = dev.get("duration_drift", [])
    if duration_drift:
        lines.append("")
        lines.append("Drift by Duration:")
        lines.append("  Duration    | Avg Drift | Median | Count | Problematic (>5%)")
        lines.append("  " + "-" * 65)
        for dd in duration_drift:
            avg = f"{dd['avg_drift']:.1f}%" if dd["avg_drift"] is not None else "N/A"
            med = f"{dd['median_drift']:.1f}%" if dd["median_drift"] is not None else "N/A"
            prob = f"{dd['problematic_count']}/{dd['count']} ({dd['problematic_pct']}%)"
            lines.append(f"  {dd['bucket']:<11} | {avg:>9} | {med:>6} | {dd['count']:>5} | {prob}")

    # Drift threshold
    threshold = dev.get("drift_threshold")
    lines.append("")
    if threshold:
        lines.append(f"  Drift threshold: {threshold} — this is where your HR starts running away")
        lines.append("  Target: push this threshold out to longer durations over time")
    else:
        lines.append("  No problematic drift threshold found — good aerobic base!")

    # Trend
    trend = dev.get("trend")
    if trend:
        lines.append("")
        lines.append("Drift Trend (first half vs second half of period):")
        lines.append(f"  Earlier: {trend['first_half_avg']:.1f}% avg drift")
        lines.append(f"  Recent:  {trend['second_half_avg']:.1f}% avg drift")
        if trend["direction"] == "improving":
            lines.append(f"  → Improving by {trend['improvement_pct']:.1f}% — aerobic base developing well")
        elif trend["direction"] == "declining":
            lines.append(f"  → Worsening by {abs(trend['improvement_pct']):.1f}% — possible overtraining or detraining")
        else:
            lines.append(f"  → Stable ({trend['improvement_pct']:+.1f}%)")

    # Concerning rides
    concerning = dev.get("concerning_rides", [])
    if concerning:
        lines.append("")
        lines.append("Concerning Rides (high drift at low intensity — base fitness gaps):")
        for ride in concerning:
            parts = [f"  {ride['date']} {ride['name']}: {ride['drift']:.1f}% drift"]
            parts.append(f"{ride['duration_h']:.1f}h")
            if ride.get("intensity"):
                parts.append(f"IF={ride['intensity']:.2f}")
            lines.append(" | ".join(parts))
        lines.append("  → These suggest your aerobic engine needs more zone 2 volume")

    # Pacing insight
    pacing = dev.get("pacing_insight")
    if pacing:
        lines.append("")
        lines.append(f"Pacing & Drift: r={pacing['vi_drift_correlation']:+.3f}")
        lines.append(f"  → {pacing['interpretation']}")

    # Actionable summary
    lines.append("")
    lines.append("Recommendations:")
    if trend and trend["direction"] == "improving":
        lines.append("  Current approach working — maintain zone 2 volume")
    elif threshold:
        lines.append(f"  Build longer steady rides to push drift threshold past {threshold}")
        lines.append("  Keep intensity strictly Z2 (IF 0.65-0.75) on base rides")
    if concerning:
        lines.append("  Address easy-ride drift with nose-breathing discipline and lower targets")
    if pacing and pacing["vi_drift_correlation"] > 0.3:
        lines.append("  Steadier pacing on long rides will reduce your drift — avoid surges")

    return "\n".join(lines)
