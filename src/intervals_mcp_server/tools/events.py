"""
Event/calendar MCP tools for Intervals.icu.

Consolidated event management including bulk operations, tags, plan application.
"""

import json
from datetime import datetime
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.utils.dates import get_default_end_date, get_default_future_end_date
from intervals_mcp_server.utils.formatting import format_event_details, format_event_summary
from intervals_mcp_server.utils.types import WorkoutDoc
from intervals_mcp_server.utils.validation import resolve_athlete_id, validate_date

from intervals_mcp_server.mcp_instance import mcp  # noqa: F401

config = get_config()


def _resolve_workout_type(name: str | None, workout_type: str | None) -> str:
    if workout_type:
        return workout_type
    name_lower = name.lower() if name else ""
    mapping = [
        ("Ride", ["bike", "cycle", "cycling", "ride"]),
        ("Run", ["run", "running", "jog", "jogging"]),
        ("Swim", ["swim", "swimming", "pool"]),
        ("Walk", ["walk", "walking", "hike", "hiking"]),
        ("Row", ["row", "rowing"]),
    ]
    for workout, keywords in mapping:
        if any(keyword in name_lower for keyword in keywords):
            return workout
    return "Ride"


@mcp.tool()
async def manage_events(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    event_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage calendar events on Intervals.icu (list, get, delete, bulk operations, tags, plans, time-off, auto-link).

    Args:
        action: One of: list, get, delete, delete_range, tags, bulk_create, apply_plan,
                duplicate, mark_done, create_time_off, list_time_off, auto_link
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        event_id: Required for get, delete, mark_done
        start_date: Start date YYYY-MM-DD for list, delete_range, duplicate, list_time_off,
                    auto_link range (optional for list/list_time_off)
        end_date: End date YYYY-MM-DD for list, delete_range, duplicate, list_time_off,
                  auto_link range
        data: Extra data depending on action:
              - bulk_create: list of event dicts
              - apply_plan: {"folder_id": int, "start_date": "YYYY-MM-DD"}
              - duplicate: {"target_start": "YYYY-MM-DD"}
              - create_time_off: {"start_date": "YYYY-MM-DD", "end_date"?: "YYYY-MM-DD",
                                  "kind"?: "HOLIDAY"|"SICK"|"INJURED", "note"?: str}
              - auto_link: {"date": "YYYY-MM-DD"} for single day, or use start_date+end_date
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        s = start_date or get_default_end_date()
        e = end_date or get_default_future_end_date()
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events", api_key=api_key, params={"oldest": s, "newest": e}
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result or not isinstance(result, list) or not result:
            return "No events found."
        return "Events:\n\n" + "\n\n".join(format_event_summary(e) for e in result if isinstance(e, dict))

    elif action == "get":
        if not event_id:
            return "Error: 'event_id' required for get"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events/{event_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return format_event_details(result)
        return "Not found."

    elif action == "delete":
        if not event_id:
            return "Error: 'event_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events/{event_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted event {event_id}."

    elif action == "delete_range":
        if not start_date or not end_date:
            return "Error: 'start_date' and 'end_date' required for delete_range"
        params = {"oldest": validate_date(start_date), "newest": validate_date(end_date)}
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events", api_key=api_key, params=params
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        events_list = result if isinstance(result, list) else []
        failed = []
        for ev in events_list:
            del_result = await make_intervals_request(
                url=f"/athlete/{athlete_id_to_use}/events/{ev.get('id')}", api_key=api_key, method="DELETE"
            )
            if isinstance(del_result, dict) and "error" in del_result:
                failed.append(ev.get("id"))
        deleted = len(events_list) - len(failed)
        return f"Deleted {deleted} events." + (f" Failed: {failed}" if failed else "")

    elif action == "tags":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/event-tags", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No event tags found."
        return f"Event Tags:\n\n{json.dumps(result, indent=2)}"

    elif action == "bulk_create":
        if not data:
            return "Error: 'data' required for bulk_create (list of event dicts)"
        events_data = data if isinstance(data, list) else data.get("events", [])
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events/bulk", api_key=api_key, method="POST", data=events_data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, list):
            return f"Created {len(result)} events."
        return json.dumps(result, indent=2)

    elif action == "apply_plan":
        if not data or "folder_id" not in data:
            return "Error: 'data' with 'folder_id' and 'start_date' required for apply_plan"
        plan_data = {"folderId": data["folder_id"], "startDate": data.get("start_date", start_date or datetime.now().strftime("%Y-%m-%d"))}
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events/apply-plan", api_key=api_key, method="POST", data=plan_data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, list):
            return f"Applied training plan. {len(result)} events created."
        return json.dumps(result, indent=2)

    elif action == "duplicate":
        if not start_date or not end_date:
            return "Error: 'start_date' and 'end_date' required for source range"
        if not data or "target_start" not in data:
            return "Error: 'data' with 'target_start' required for duplicate"
        dup_data = {"oldest": start_date, "newest": end_date, "targetStart": data["target_start"]}
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/duplicate-events", api_key=api_key, method="POST", data=dup_data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, list):
            return f"Duplicated {len(result)} events to {data['target_start']}."
        return json.dumps(result, indent=2)

    elif action == "mark_done":
        if not event_id:
            return "Error: 'event_id' required for mark_done"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events/{event_id}/mark-done", api_key=api_key, method="POST"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Event {event_id} marked as done. Activity created (ID: {result.get('id', 'unknown')})."
        return f"Event {event_id} marked as done."

    elif action == "create_time_off":
        from intervals_mcp_server.services.events import create_time_off

        if not data and not start_date:
            return "Error: 'data' with 'start_date' required for create_time_off"
        d = data or {}
        sd = d.get("start_date") or start_date
        if not sd:
            return "Error: 'start_date' required for create_time_off"
        try:
            created = await create_time_off(
                start_date=sd,
                end_date=d.get("end_date") or end_date,
                kind=d.get("kind", "HOLIDAY"),
                note=d.get("note"),
                athlete_id=athlete_id,
            )
        except Exception as exc:
            return f"Error: {exc}"
        return f"Created time-off event (ID: {created.get('id')}, kind: {created.get('category')}, date: {sd})."

    elif action == "list_time_off":
        from intervals_mcp_server.services.events import list_time_off

        s = start_date or get_default_end_date()
        e = end_date or get_default_future_end_date()
        try:
            events = await list_time_off(oldest=s, newest=e, athlete_id=athlete_id)
        except Exception as exc:
            return f"Error: {exc}"
        if not events:
            return "No time-off events found."
        return "Time-off events:\n\n" + "\n\n".join(
            format_event_summary(ev) for ev in events if isinstance(ev, dict)
        )

    elif action == "auto_link":
        from intervals_mcp_server.services.events import auto_link_day, auto_link_range

        d = data or {}
        single_date = d.get("date") or start_date
        if single_date and not end_date:
            try:
                result = await auto_link_day(single_date, athlete_id=athlete_id)
            except Exception as exc:
                return f"Error: {exc}"
            linked = result["linked"]
            unmatched_w = result["unmatched_workouts"]
            unmatched_a = result["unmatched_activities"]
            parts = [f"Auto-link {single_date}: {len(linked)} paired."]
            if linked:
                parts.append("Linked: " + ", ".join(f"{lk['name']} → act {lk['activity_id']}" for lk in linked))
            if unmatched_w:
                parts.append("Unmatched workouts: " + ", ".join(w["name"] or str(w["event_id"]) for w in unmatched_w))
            if unmatched_a:
                parts.append("Unmatched activities: " + ", ".join(a["name"] or str(a["activity_id"]) for a in unmatched_a))
            return "\n".join(parts)
        oldest_r = d.get("oldest") or start_date
        newest_r = d.get("newest") or end_date
        if not oldest_r or not newest_r:
            return "Error: provide 'date' (data) or start_date+end_date for auto_link"
        try:
            result = await auto_link_range(oldest_r, newest_r, athlete_id=athlete_id)
        except Exception as exc:
            return f"Error: {exc}"
        linked = result["linked"]
        return (
            f"Auto-link {oldest_r} to {newest_r}: {len(linked)} paired, "
            f"{len(result['unmatched_workouts'])} unmatched workouts, "
            f"{len(result['unmatched_activities'])} unmatched activities."
        )

    return f"Invalid action '{action}'. Must be one of: list, get, delete, delete_range, tags, bulk_create, apply_plan, duplicate, mark_done, create_time_off, list_time_off, auto_link"


@mcp.tool()
async def add_or_update_event(
    workout_type: str,
    name: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    event_id: str | None = None,
    start_date: str | None = None,
    workout_doc: WorkoutDoc | None = None,
    moving_time: int | None = None,
    distance: int | None = None,
) -> str:
    """Create or update a planned workout event on Intervals.icu.

    If event_id is provided, updates the existing event. Otherwise creates a new one.

    Args:
        workout_type: Workout type (e.g. Ride, Run, Swim, Walk, Row)
        name: Name of the workout
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        event_id: Existing event ID for updates (optional)
        start_date: Start date YYYY-MM-DD (optional, defaults to today)
        workout_doc: Structured workout definition with steps (optional)
        moving_time: Total expected moving time in seconds (optional)
        distance: Total expected distance in meters (optional)

    workout_doc format:
        {"description": "...", "steps": [
            {"power": {"value": 80, "units": "%ftp"}, "duration": 900, "warmup": true},
            {"reps": 2, "steps": [
                {"power": {"value": 110, "units": "%ftp"}, "distance": 500},
                {"power": {"value": 80, "units": "%ftp"}, "duration": 90}
            ]},
            {"power": {"value": 80, "units": "%ftp"}, "duration": 600, "cooldown": true}
        ]}

    Step intensity options: power (%ftp, w, power_zone), hr (%hr, %lthr, hr_zone), pace (%pace, pace_zone), cadence
    Step duration: "duration" (seconds) or "distance" (meters)
    Repeats: {"reps": N, "steps": [...]}
    Ramps: {"ramp": true, "power": {"start": 80, "end": 90, "units": "%ftp"}}
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    if not start_date:
        start_date = datetime.now().strftime("%Y-%m-%d")

    resolved_type = _resolve_workout_type(name, workout_type)
    event_data: dict[str, Any] = {
        "start_date_local": start_date + "T00:00:00",
        "category": "WORKOUT",
        "name": name,
        "description": str(workout_doc) if workout_doc else None,
        "type": resolved_type,
        "moving_time": moving_time,
        "distance": distance,
    }

    url = f"/athlete/{athlete_id_to_use}/events"
    method = "POST"
    if event_id:
        url += f"/{event_id}"
        method = "PUT"

    result = await make_intervals_request(url=url, api_key=api_key, data=event_data, method=method)

    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"

    action = "Updated" if event_id else "Created"
    if isinstance(result, dict):
        return f"{action} event (ID: {result.get('id')})."
    return f"{action} event at {start_date}."
