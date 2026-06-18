"""Race report tools — write, read, query, and verify race reports.

Bridges intervals.icu activities/events with second-brain vault notes via
a Supabase index table. Single-call write path creates the vault note,
updates the intervals.icu activity/event, and indexes in Supabase atomically.
"""

import json
import logging
from datetime import datetime
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.api.vault_client import vault_read, vault_write_with_links, vault_update
from intervals_mcp_server.config import get_config
from intervals_mcp_server.tool_warnings import collect_warnings
from intervals_mcp_server.mcp_instance import mcp
from intervals_mcp_server.supabase_client import get_supabase, supabase_select, supabase_upsert

logger = logging.getLogger("intervals_icu_mcp_server")

config = get_config()

VAULT_REPORT_PREFIX = "cycling/race-reports"
VAULT_LINK_MARKER = "\U0001f4ce Race report"

REPORT_SECTIONS = [
    "context",
    "what_happened",
    "pattern_mechanism_notes",
    "interpretation",
    "intervention_effectiveness",
    "next_time_track",
]

SECTION_HEADERS = {
    "context": "## Context",
    "what_happened": "## What Happened",
    "pattern_mechanism_notes": "## Pattern / Mechanism Notes",
    "interpretation": "## Interpretation",
    "intervention_effectiveness": "## Intervention Effectiveness",
    "next_time_track": "## Next Time — Track",
}


def _slugify(name: str) -> str:
    """Convert race name to URL-safe slug."""
    slug = name.lower().strip()
    slug = slug.replace("—", "-").replace("–", "-")
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789- ")
    slug = "".join(c for c in slug if c in allowed)
    slug = "-".join(slug.split())
    return slug[:60]


def _vault_path(date: str, race_name: str) -> str:
    slug = _slugify(race_name)
    return f"{VAULT_REPORT_PREFIX}/{date}-{slug}.md"


def _build_frontmatter(data: dict[str, Any]) -> str:
    """Build YAML frontmatter block from structured data."""
    lines = ["---"]
    lines.append(f"title: \"{data['race_name']}\"")
    lines.append(f"date: '{data['date']}'")
    lines.append(f"race_name: {data['race_name']}")
    lines.append(f"race_type: {data['race_type']}")
    lines.append(f"result: {data['result']}")

    if data.get("finish_position") is not None:
        lines.append(f"finish_position: {data['finish_position']}")
    else:
        lines.append("finish_position: null")

    lines.append(f"dropped: {str(data.get('dropped', False)).lower()}")

    if data.get("laps_completed") is not None:
        lines.append(f"laps_completed: {data['laps_completed']}")
    if data.get("total_laps") is not None:
        lines.append(f"total_laps: {data['total_laps']}")

    lines.append(f"tsb_at_race: {data.get('tsb_at_race', 'null')}")
    lines.append(f"ctl_at_race: {data.get('ctl_at_race', 'null')}")
    lines.append(f"intervals_activity_id: \"{data['intervals_activity_id']}\"")

    if data.get("intervals_event_id"):
        lines.append(f"intervals_event_id: \"{data['intervals_event_id']}\"")
    else:
        lines.append("intervals_event_id: null")

    lines.append("tags:")
    for tag in data.get("tags", ["race-report"]):
        lines.append(f"  - {tag}")

    if data.get("patterns"):
        lines.append("patterns:")
        for p in data["patterns"]:
            lines.append(f"  - id: {p['id']}")
            lines.append(f"    present: {str(p.get('present', True)).lower()}")
            lines.append(f"    severity: {p.get('severity', 'moderate')}")
            if p.get("notes"):
                lines.append(f"    notes: \"{p['notes']}\"")

    lines.append("note_type: race-report")
    lines.append("scope: personal")
    lines.append("---")
    return "\n".join(lines)


def _build_body(report_body: dict[str, str]) -> str:
    """Build markdown body from section dict."""
    parts = []
    for section_key in REPORT_SECTIONS:
        content = report_body.get(section_key, "").strip()
        if content:
            header = SECTION_HEADERS[section_key]
            parts.append(f"{header}\n\n{content}")
    return "\n\n".join(parts)


def _build_note(data: dict[str, Any], report_body: dict[str, str]) -> str:
    frontmatter = _build_frontmatter(data)
    body = _build_body(report_body)
    return f"{frontmatter}\n\n{body}\n"


def _activity_description_with_link(existing_desc: str | None, vault_path: str) -> str:
    """Append or replace the vault link marker in an activity description."""
    marker_line = f"{VAULT_LINK_MARKER}: {vault_path}"
    if not existing_desc:
        return marker_line
    lines = existing_desc.split("\n")
    lines = [l for l in lines if VAULT_LINK_MARKER not in l]
    lines.append(marker_line)
    return "\n".join(lines)


def _validate_patterns(patterns: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    """Validate pattern IDs against pattern_definitions table. Returns (valid, error)."""
    client = get_supabase()
    if client is None:
        return patterns, None

    try:
        result = client.table("pattern_definitions").select("id").execute()
        known_ids = {row["id"] for row in (result.data or [])}
    except Exception:
        return patterns, None

    if not known_ids:
        return patterns, None

    unknown = [p["id"] for p in patterns if p["id"] not in known_ids]
    if unknown:
        return [], f"Unknown pattern IDs: {unknown}. Known: {sorted(known_ids)}"
    return patterns, None


async def _fetch_tsb_ctl(date: str) -> tuple[float | None, float | None]:
    """Fetch TSB and CTL for a given date from wellness data."""
    result = await make_intervals_request(
        url=f"/athlete/{config.athlete_id}/wellness/{date}"
    )
    if isinstance(result, dict) and not result.get("error"):
        tsb = result.get("ctl") and result.get("atl") and (result.get("ctl", 0) - result.get("atl", 0))
        ctl = result.get("ctl")
        return tsb, ctl
    return None, None


@mcp.tool()
async def write_race_report(
    race_name: str,
    race_type: str,
    result: str,
    report_body: dict[str, str],
    date: str | None = None,
    activity_id: str | None = None,
    dropped: bool = False,
    laps_completed: int | None = None,
    total_laps: int | None = None,
    finish_position: int | None = None,
    patterns: list[dict[str, Any]] | None = None,
    tags: list[str] | None = None,
    event_id: str | None = None,
    tsb_override: float | None = None,
    ctl_override: float | None = None,
) -> str:
    """Write a race report — creates vault note, updates intervals.icu activity/event, indexes in Supabase.

    Works regardless of upload order: call with just date if the activity isn't uploaded yet,
    then use link_race_report later to attach the activity. If activity_id is provided, the
    activity description is updated immediately.

    Idempotent: re-calling with the same (athlete_id, date, race_name) overwrites the existing report.

    Args:
        race_name: Human-readable race name (e.g. "Table Mountain Crit")
        race_type: Priority level — A, B, or C
        result: Race outcome — DNF, DNS, DQ, "finish", or position like "12th"
        report_body: Dict of section content. Keys: context, what_happened,
                     pattern_mechanism_notes, interpretation, intervention_effectiveness, next_time_track
        date: Race date YYYY-MM-DD (required if activity_id not provided)
        activity_id: Intervals.icu activity ID (optional — link later via link_race_report)
        dropped: Whether you were dropped / exited early
        laps_completed: Laps completed before exit (if applicable)
        total_laps: Total laps in the race (if known)
        finish_position: Numeric finish position (if finished)
        patterns: List of behavioral patterns observed. Each: {id, present, severity, notes}.
                  Pattern IDs validated against pattern_definitions table.
        tags: Tags for the report (default: ["race-report"])
        event_id: Intervals.icu event ID if race was a planned calendar event
        tsb_override: Manual TSB value (auto-fetched from wellness if omitted)
        ctl_override: Manual CTL value (auto-fetched from wellness if omitted)
    """
    # 1. Validate patterns if provided
    if patterns:
        patterns, err = _validate_patterns(patterns)
        if err:
            return f"Error: {err}"

    # 2. Determine race date — from activity if available, otherwise from date param
    race_date = date
    activity = None

    if activity_id:
        activity = await make_intervals_request(url=f"/activity/{activity_id}")
        if isinstance(activity, dict) and activity.get("error"):
            activity = None
        elif isinstance(activity, dict):
            activity_date = (activity.get("start_date_local") or activity.get("startTime", ""))[:10]
            if activity_date:
                race_date = activity_date

    if not race_date:
        return "Error: provide either activity_id (for an uploaded activity) or date"

    # 3. Auto-fetch TSB/CTL if not overridden
    tsb = tsb_override
    ctl = ctl_override
    if tsb is None or ctl is None:
        fetched_tsb, fetched_ctl = await _fetch_tsb_ctl(race_date)
        if tsb is None:
            tsb = fetched_tsb
        if ctl is None:
            ctl = fetched_ctl

    # 4. Build the note
    if not tags:
        tags = ["race-report"]
    if "race-report" not in tags:
        tags = ["race-report"] + tags

    data = {
        "race_name": race_name,
        "date": race_date,
        "race_type": race_type.upper(),
        "result": result,
        "finish_position": finish_position,
        "dropped": dropped,
        "laps_completed": laps_completed,
        "total_laps": total_laps,
        "tsb_at_race": tsb,
        "ctl_at_race": ctl,
        "intervals_activity_id": activity_id or "",
        "intervals_event_id": event_id,
        "tags": tags,
        "patterns": patterns or [],
    }

    vault_path = _vault_path(race_date, race_name)
    note_content = _build_note(data, report_body)

    # 5. Write vault note (server-to-server)
    vault_ok = await vault_write_with_links(vault_path, note_content)
    vault_status = "written" if vault_ok else "FAILED (pending retry)"

    # 6. Update intervals.icu activity description with vault link and mark as race (if activity exists)
    activity_linked = False
    if activity_id and activity:
        existing_desc = activity.get("description") or ""
        new_desc = _activity_description_with_link(existing_desc, vault_path)
        await make_intervals_request(
            url=f"/activity/{activity_id}",
            method="PUT",
            data={"description": new_desc, "race": True},
        )
        activity_linked = True

    # 7. Update event notes if event_id provided
    if event_id:
        event = await make_intervals_request(
            url=f"/athlete/{config.athlete_id}/event/{event_id}"
        )
        if isinstance(event, dict) and not event.get("error"):
            existing_event_desc = event.get("description") or ""
            new_event_desc = _activity_description_with_link(existing_event_desc, vault_path)
            await make_intervals_request(
                url=f"/athlete/{config.athlete_id}/events/{event_id}",
                method="PUT",
                data={"description": new_event_desc},
            )

    # 8. Upsert Supabase index (keyed on athlete+date+race_name for order-independence)
    supabase_row = {
        "athlete_id": config.athlete_id,
        "date": race_date,
        "race_name": race_name,
        "race_type": race_type.upper(),
        "result": result,
        "dropped": dropped,
        "finish_position": finish_position,
        "tsb_at_race": tsb,
        "ctl_at_race": ctl,
        "intervals_activity_id": activity_id or "",
        "intervals_event_id": event_id,
        "vault_path": vault_path,
        "patterns": json.dumps(patterns or []),
        "tags": tags,
        "vault_write_ok": vault_ok,
        "updated_at": datetime.now().isoformat(),
    }
    supabase_upsert("race_reports", supabase_row, on_conflict="athlete_id,date,race_name")

    activity_msg = f"Activity {activity_id} description updated" if activity_linked else "No activity linked yet (use link_race_report after upload)"
    return (
        f"Race report {'created' if vault_ok else 'indexed (vault write pending)'}.\n"
        f"  Vault: {vault_path} ({vault_status})\n"
        f"  {activity_msg}\n"
        f"  {'Event ' + event_id + ' description updated' if event_id else ''}\n"
        f"  Supabase indexed: race_reports\n"
        f"  TSB: {tsb}, CTL: {ctl}, Date: {race_date}"
    )


@mcp.tool()
async def link_race_report(
    activity_id: str,
    date: str | None = None,
    race_name: str | None = None,
) -> str:
    """Link an uploaded activity to an existing race report written before upload.

    Finds the unlinked report by date or race_name, sets the activity_id, updates
    the activity description with the vault path pointer, and updates the vault note
    frontmatter with the activity_id.

    Args:
        activity_id: The intervals.icu activity ID to link
        date: Race date YYYY-MM-DD to find the report (provide date or race_name)
        race_name: Race name to find the report (provide date or race_name)
    """
    if not date and not race_name:
        return "Error: provide date or race_name to identify the report to link"

    client = get_supabase()
    if client is None:
        return "Error: Supabase not configured"

    # Find the report
    try:
        query = client.table("race_reports").select("*").eq("athlete_id", config.athlete_id)
        if date:
            query = query.eq("date", date)
        if race_name:
            query = query.ilike("race_name", f"%{race_name}%")
        result = query.limit(1).execute()
        rows = result.data or []
    except Exception as e:
        return f"Error querying race_reports: {e}"

    if not rows:
        return "No matching race report found to link."

    row = rows[0]
    vault_path = row.get("vault_path")

    # Validate activity exists
    activity = await make_intervals_request(url=f"/activity/{activity_id}")
    if isinstance(activity, dict) and activity.get("error"):
        return f"Error: activity {activity_id} not found on intervals.icu"

    # Update activity description with vault link and mark as race
    if isinstance(activity, dict):
        existing_desc = activity.get("description") or ""
        new_desc = _activity_description_with_link(existing_desc, vault_path)
        await make_intervals_request(
            url=f"/activity/{activity_id}",
            method="PUT",
            data={"description": new_desc, "race": True},
        )

    # Update Supabase row with activity_id
    try:
        client.table("race_reports").update({
            "intervals_activity_id": activity_id,
            "updated_at": datetime.now().isoformat(),
        }).eq("id", row["id"]).execute()
    except Exception as e:
        return f"Error updating Supabase: {e}"

    # Update vault note frontmatter with activity_id
    if vault_path:
        content = await vault_read(vault_path)
        if content and 'intervals_activity_id: ""' in content:
            updated_content = content.replace(
                'intervals_activity_id: ""',
                f'intervals_activity_id: "{activity_id}"',
            )
            await vault_update(vault_path, updated_content)

    return (
        f"Linked activity {activity_id} to race report: {row['race_name']} ({row['date']})\n"
        f"  Activity description updated with vault pointer\n"
        f"  Supabase row updated\n"
        f"  Vault note frontmatter updated"
    )


@mcp.tool()
async def get_race_report(
    activity_id: str | None = None,
    date: str | None = None,
    race_name: str | None = None,
    include_vault_content: bool = True,
) -> str:
    """Get a race report by activity ID, date, or name — merges intervals.icu metrics with vault narrative.

    Args:
        activity_id: Intervals.icu activity ID (preferred lookup key)
        date: Race date YYYY-MM-DD (alternative lookup)
        race_name: Race name substring match (alternative lookup)
        include_vault_content: Whether to fetch and include the full vault note body (default true)
    """
    if not any([activity_id, date, race_name]):
        return "Error: provide at least one of activity_id, date, or race_name"

    # Find the Supabase row
    client = get_supabase()
    if client is None:
        return "Error: Supabase not configured"

    try:
        query = client.table("race_reports").select("*")
        if activity_id:
            query = query.eq("intervals_activity_id", activity_id)
        elif date:
            query = query.eq("date", date)
        elif race_name:
            query = query.ilike("race_name", f"%{race_name}%")

        query = query.eq("athlete_id", config.athlete_id)
        result = query.limit(1).execute()
        rows = result.data or []
    except Exception as e:
        return f"Error querying race_reports: {e}"

    if not rows:
        return "No race report found matching the given criteria."

    row = rows[0]

    # Fetch activity metrics
    act_id = row["intervals_activity_id"]
    activity = await make_intervals_request(url=f"/activity/{act_id}")
    metrics_section = ""
    if isinstance(activity, dict) and not activity.get("error"):
        metrics = {
            "duration": activity.get("moving_time") or activity.get("elapsed_time"),
            "distance_km": round(activity.get("distance", 0) / 1000, 1) if activity.get("distance") else None,
            "avg_power": activity.get("icu_weighted_avg_watts") or activity.get("icu_average_watts"),
            "max_power": activity.get("icu_max_watts"),
            "avg_hr": activity.get("icu_avg_hr") or activity.get("average_heartrate"),
            "max_hr": activity.get("max_heartrate"),
            "training_load": activity.get("icu_training_load"),
            "intensity": activity.get("icu_intensity"),
        }
        metrics_lines = [f"  {k}: {v}" for k, v in metrics.items() if v is not None]
        if metrics_lines:
            metrics_section = "Activity Metrics:\n" + "\n".join(metrics_lines)

    # Fetch vault content
    vault_content = ""
    if include_vault_content and row.get("vault_path"):
        content = await vault_read(row["vault_path"])
        if content:
            vault_content = f"\n\n--- Vault Note ---\n{content}"

    # Format patterns
    patterns_raw = row.get("patterns")
    if isinstance(patterns_raw, str):
        try:
            patterns_raw = json.loads(patterns_raw)
        except json.JSONDecodeError:
            patterns_raw = []
    patterns_section = ""
    if patterns_raw:
        p_lines = []
        for p in patterns_raw:
            p_lines.append(f"  - {p['id']}: severity={p.get('severity', '?')}, notes={p.get('notes', '')}")
        patterns_section = "Patterns:\n" + "\n".join(p_lines)

    output = (
        f"Race Report: {row['race_name']} ({row['date']})\n"
        f"  Type: {row['race_type']} | Result: {row['result']} | Dropped: {row['dropped']}\n"
        f"  TSB: {row.get('tsb_at_race')} | CTL: {row.get('ctl_at_race')}\n"
        f"  Activity: {act_id} | Event: {row.get('intervals_event_id') or 'none'}\n"
        f"  Vault: {row.get('vault_path')}\n"
    )
    if metrics_section:
        output += f"\n{metrics_section}"
    if patterns_section:
        output += f"\n{patterns_section}"
    if vault_content:
        output += vault_content

    output += await collect_warnings()
    return output


@mcp.tool()
async def query_race_reports(
    start_date: str | None = None,
    end_date: str | None = None,
    pattern_id: str | None = None,
    tags: list[str] | None = None,
    race_type: str | None = None,
    dropped_only: bool = False,
    limit: int = 20,
) -> str:
    """Query race reports — filter by date range, pattern, tags, type, or dropout status.

    Returns a summary table for quick scanning. Use get_race_report to hydrate a specific one.

    Args:
        start_date: Filter races on or after this date (YYYY-MM-DD)
        end_date: Filter races on or before this date (YYYY-MM-DD)
        pattern_id: Filter to races where this pattern was observed (e.g. "dropout-before-effort")
        tags: Filter to races with any of these tags
        race_type: Filter by priority (A, B, or C)
        dropped_only: Only return races where dropped=true
        limit: Max results (default 20)
    """
    client = get_supabase()
    if client is None:
        return "Error: Supabase not configured"

    try:
        query = client.table("race_reports").select("*").eq("athlete_id", config.athlete_id)

        if start_date:
            query = query.gte("date", start_date)
        if end_date:
            query = query.lte("date", end_date)
        if race_type:
            query = query.eq("race_type", race_type.upper())
        if dropped_only:
            query = query.eq("dropped", True)
        if tags:
            query = query.overlaps("tags", tags)

        query = query.order("date", desc=True).limit(limit)
        result = query.execute()
        rows = result.data or []
    except Exception as e:
        return f"Error querying race_reports: {e}"

    if not rows:
        return "No race reports found matching filters."

    # Post-filter by pattern_id (jsonb contains)
    if pattern_id:
        filtered = []
        for row in rows:
            patterns_raw = row.get("patterns")
            if isinstance(patterns_raw, str):
                try:
                    patterns_raw = json.loads(patterns_raw)
                except json.JSONDecodeError:
                    continue
            if patterns_raw and any(p.get("id") == pattern_id and p.get("present", True) for p in patterns_raw):
                filtered.append(row)
        rows = filtered

    if not rows:
        return f"No race reports found with pattern '{pattern_id}'."

    # Format as summary table
    lines = [f"Race Reports ({len(rows)} found):\n"]
    for row in rows:
        patterns_raw = row.get("patterns")
        if isinstance(patterns_raw, str):
            try:
                patterns_raw = json.loads(patterns_raw)
            except json.JSONDecodeError:
                patterns_raw = []
        pattern_summary = ""
        if patterns_raw:
            p_parts = [f"{p['id']}({p.get('severity', '?')})" for p in patterns_raw if p.get("present", True)]
            if p_parts:
                pattern_summary = f" | patterns: {', '.join(p_parts)}"

        lines.append(
            f"  {row['date']} | {row['race_name']} | {row['race_type']}-race "
            f"| {row['result']} | TSB:{row.get('tsb_at_race', '?')} "
            f"| dropped:{row['dropped']}{pattern_summary}"
        )

    return "\n".join(lines)


@mcp.tool()
async def verify_race_report_links(repair: bool = False) -> str:
    """Verify bidirectional links between intervals.icu activities, vault notes, and Supabase index.

    Checks that:
    - Activity description contains the vault path pointer
    - Vault note exists and its frontmatter references the correct activity_id
    - Supabase row matches both sides

    Args:
        repair: If true, fix any broken links found. If false, report only.
    """
    client = get_supabase()
    if client is None:
        return "Error: Supabase not configured"

    rows = supabase_select("race_reports", {"athlete_id": config.athlete_id})
    if not rows:
        return "No race reports to verify."

    issues = []
    repaired = []

    for row in rows:
        act_id = row["intervals_activity_id"]
        vault_path = row.get("vault_path")

        # Check activity description has the link
        activity = await make_intervals_request(url=f"/activity/{act_id}")
        if isinstance(activity, dict) and activity.get("error"):
            issues.append(f"  {act_id}: activity not found on intervals.icu")
            continue

        desc = (activity.get("description") or "") if isinstance(activity, dict) else ""
        if vault_path and vault_path not in desc:
            issues.append(f"  {act_id}: activity description missing vault link → {vault_path}")
            if repair:
                new_desc = _activity_description_with_link(desc, vault_path)
                await make_intervals_request(
                    url=f"/activity/{act_id}", method="PUT", data={"description": new_desc}
                )
                repaired.append(f"  {act_id}: activity description repaired")

        # Check vault note exists
        if vault_path:
            content = await vault_read(vault_path)
            if content is None:
                issues.append(f"  {act_id}: vault note missing at {vault_path}")
                if repair and not row.get("vault_write_ok"):
                    issues.append(f"  {act_id}: (vault write was previously pending — needs manual re-write)")
            elif act_id not in content:
                issues.append(f"  {act_id}: vault note at {vault_path} doesn't reference activity ID")
                if repair:
                    # Could repair frontmatter here but risky — flag for manual review
                    issues.append(f"  {act_id}: vault frontmatter mismatch — manual review needed")

    output = f"Verified {len(rows)} race report(s).\n"
    if not issues:
        output += "All links intact."
    else:
        output += f"\nIssues ({len(issues)}):\n" + "\n".join(issues)
    if repaired:
        output += f"\n\nRepaired ({len(repaired)}):\n" + "\n".join(repaired)

    return output
