"""Activity analysis tools — deep coaching analysis powered by directeur + DeepSeek."""

from intervals_mcp_server.directeur_client import (
    get_activity_analysis as _fetch_analysis,
    get_recent_analyses,
    trigger_activity_analysis,
)
from intervals_mcp_server.mcp_instance import mcp


SEVERITY_ICONS = {"critical": "\U0001f6a8", "flag": "⚠️", "info": "ℹ️"}


def _format_finding(f: dict) -> str:
    icon = SEVERITY_ICONS.get(f.get("severity", ""), "")
    title = f.get("title", "")
    detail = f.get("detail", "")
    lap = f.get("lap")
    lap_str = f" (lap {lap})" if lap else ""
    return f"  {icon} **{title}**{lap_str} — {detail}"


def _format_lap_row(lap: dict) -> str:
    num = lap.get("lap_number", "?")
    power = lap.get("avg_power", "?")
    hr = lap.get("avg_hr", "?")
    grade = lap.get("grade", "?")
    notes = lap.get("notes", "")
    return f"  | {num} | {power}W | {hr} | {grade} | {notes} |"


def _format_analysis(data: dict) -> str:
    lines = []

    name = data.get("activity_name", "Activity")
    grade = data.get("overall_grade", "?")
    mode = data.get("mode", "standard")
    lines.append(f"## Coach's Analysis — {grade} ({mode})")
    lines.append(f"**{name}** ({data.get('activity_date', '')})")
    lines.append("")

    summary = data.get("executive_summary")
    if summary:
        lines.append(summary)
        lines.append("")

    tactical = data.get("tactical_summary")
    if tactical:
        lines.append("### Tactical Review")
        lines.append(tactical)
        lines.append("")

    findings = data.get("findings", [])
    if findings:
        lines.append("### Findings")
        for f in findings:
            lines.append(_format_finding(f))
        lines.append("")

    match_burns = data.get("match_burns")
    if match_burns:
        lines.append("### Match Burns")
        lines.append("  | Time | Peak | Duration | Context |")
        lines.append("  |------|------|----------|---------|")
        for mb in match_burns:
            ts = mb.get("timestamp_seconds", 0)
            mins = ts // 60
            peak = mb.get("watts_peak", "?")
            dur = mb.get("duration_seconds", "?")
            ctx = mb.get("context", "")
            lines.append(f"  | {mins}min | {peak}W | {dur}s | {ctx} |")
        lines.append("")

    laps = data.get("lap_analyses", [])
    if laps:
        lines.append("### Laps")
        lines.append("  | Lap | Power | HR | Grade | Note |")
        lines.append("  |-----|-------|-----|-------|------|")
        for lap in laps:
            lines.append(_format_lap_row(lap))
        lines.append("")

    analyzed_at = data.get("analyzed_at", "")
    if analyzed_at:
        lines.append(f"*Analyzed by directeur • {analyzed_at[:10]}*")

    return "\n".join(lines)


@mcp.tool()
async def get_activity_analysis(activity_id: str) -> str:
    """Get the deep coaching analysis for an activity (lap-by-lap grades, findings, tactical review).

    Returns the directeur-generated analysis including:
    - Overall execution grade (A+ through F)
    - Executive summary of ride quality
    - Structured findings (pacing, power, HR, cadence, fatigue, tactical)
    - Lap-by-lap breakdown with grades
    - For races: tactical review and match burn tracking

    If no analysis exists yet, suggests using analyze_activity to trigger one.

    Args:
        activity_id: The Intervals.icu activity ID (e.g. "i131804:1234567")
    """
    data = await _fetch_analysis(activity_id)

    if data is None:
        return (
            f"No analysis found for activity {activity_id}. "
            f"Use analyze_activity to trigger a DeepSeek-powered coaching analysis."
        )

    if "detail" in data and "not found" in str(data.get("detail", "")).lower():
        return (
            f"No analysis found for activity {activity_id}. "
            f"Use analyze_activity to trigger a DeepSeek-powered coaching analysis."
        )

    return _format_analysis(data)


@mcp.tool()
async def analyze_activity(
    activity_id: str | None = None,
    oldest: str | None = None,
    newest: str | None = None,
    mode: str | None = None,
) -> str:
    """Trigger a deep coaching analysis of an activity or date range using DeepSeek.

    Directeur fetches the ride's power/HR/cadence streams and laps from Intervals.icu,
    sends them to DeepSeek for coaching-style analysis, writes findings to Supabase,
    and posts a coaching note on the activity in Intervals.icu.

    Standard rides get: pacing discipline, HR drift, power variability, fatigue onset,
    cadence patterns, time-in-zone efficiency analysis.

    Races get additional: tactical decisions, match burns, effort allocation, finish
    execution assessment.

    Race mode auto-detects from activity type/tags, or can be forced with mode="race".

    Args:
        activity_id: Specific activity to analyze (e.g. "i131804:1234567")
        oldest: Start date for range analysis (YYYY-MM-DD). Use with newest.
        newest: End date for range analysis (YYYY-MM-DD). Use with oldest.
        mode: Force analysis mode — "standard" or "race". Auto-detects if omitted.
    """
    if not activity_id and not (oldest and newest):
        return "Provide either activity_id or both oldest and newest dates."

    result = await trigger_activity_analysis(
        activity_id=activity_id,
        oldest=oldest,
        newest=newest,
        mode=mode,
    )

    if result is None:
        return (
            "Activity analysis unavailable — directeur not reachable or not configured. "
            "The /actions/analyze endpoint may not be deployed yet."
        )

    analyzed = result.get("analyzed", [])
    skipped = result.get("skipped", [])
    errors = result.get("errors", [])

    lines = []
    if analyzed:
        lines.append(f"Analyzed {len(analyzed)} activit{'y' if len(analyzed) == 1 else 'ies'}:")
        for a in analyzed:
            lines.append(f"  - {a}")
    if skipped:
        lines.append(f"Skipped {len(skipped)} (already analyzed):")
        for s in skipped[:5]:
            lines.append(f"  - {s}")
        if len(skipped) > 5:
            lines.append(f"  ... and {len(skipped) - 5} more")
    if errors:
        lines.append(f"Errors ({len(errors)}):")
        for e in errors[:5]:
            lines.append(f"  - {e}")

    if not lines:
        lines.append("No activities processed.")

    if analyzed:
        lines.append("")
        lines.append("Use get_activity_analysis to view the full coaching breakdown.")

    return "\n".join(lines)
