"""
Natural-language command service: DeepSeek routes free-text commands to real tools.

interpret_command() calls DeepSeek with a tool catalog and returns a proposal of
actions classified as read or write. Reads execute immediately; writes are previewed
and only run after explicit confirmation (execute_actions()).

The web API loop lives here — DeepSeek does routing only, the service executes against
the existing events/library/coaching service functions.
"""

import json
import logging
from datetime import date, timedelta
from typing import Any

from intervals_mcp_server.deepseek_client import chat_completion
from intervals_mcp_server.services import coaching as coaching_svc
from intervals_mcp_server.services import events as events_svc
from intervals_mcp_server.services import library as library_svc
from intervals_mcp_server.services.errors import ServiceError

logger = logging.getLogger(__name__)

# Z2 endurance ≈ 65% FTP. Used by extend_workout when appending Z2 work.
Z2_PCT = 65

# Actions that mutate calendar/library state. Everything else is a read.
WRITE_TOOLS = {
    "create_time_off",
    "move_event",
    "update_event",
    "mark_done",
    "delete_event",
    "create_custom_workout",
    "extend_workout",
    "combine_workouts",
}


# ─── Tool catalog (OpenAI function-calling schema) ──────────────────────────────


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }


TOOL_CATALOG: list[dict[str, Any]] = [
    # ── Reads ──
    _tool(
        "list_events",
        "List planned calendar events (workouts, races, time-off) in a date range. "
        "Use for 'what's on my calendar', 'what's planned this week'.",
        {
            "oldest": {"type": "string", "description": "Start date YYYY-MM-DD"},
            "newest": {"type": "string", "description": "End date YYYY-MM-DD"},
        },
        [],
    ),
    _tool(
        "search_library",
        "Search the workout library by zone, duration, or intensity. "
        "Use for 'find a threshold workout', 'show me a 60-min vo2max session'.",
        {
            "zone_focus": {"type": "string", "description": "e.g. threshold, vo2max, endurance, sweet_spot, tempo, recovery"},
            "duration_max_minutes": {"type": "integer"},
            "duration_min_minutes": {"type": "integer"},
            "name_search": {"type": "string"},
            "limit": {"type": "integer", "description": "Default 10"},
        },
        [],
    ),
    _tool(
        "find_alternatives",
        "Find alternative workouts relative to a reference library workout id "
        "(shorter/longer/easier/harder/similar, or a different zone).",
        {
            "tr_workout_id": {"type": "string"},
            "adjustment": {"type": "string", "description": "shorter|longer|easier|harder|similar"},
            "target_zone": {"type": "string"},
            "max_duration_minutes": {"type": "integer"},
        },
        ["tr_workout_id"],
    ),
    _tool(
        "get_compliance",
        "Planned-vs-actual compliance for a specific event id.",
        {"event_id": {"type": "string"}},
        ["event_id"],
    ),
    _tool(
        "get_coaching_state",
        "Readiness verdict + behavioral patterns + progression from the coaching engine. "
        "Use for 'should I train today', 'am I recovered', 'how's my readiness'.",
        {"zone": {"type": "string", "description": "Progression zone, default threshold"}},
        [],
    ),
    _tool(
        "get_dashboard",
        "Composite snapshot: next workout, latest activity, readiness. "
        "Use for 'how's my training', 'give me an overview', 'what's next'.",
        {},
        [],
    ),
    # ── Writes ──
    _tool(
        "create_time_off",
        "Block time off on the calendar (rest/holiday/sick/injured). "
        "Use for 'give me time off', 'I'm sick this week', 'rest day Monday'.",
        {
            "start_date": {"type": "string", "description": "YYYY-MM-DD"},
            "end_date": {"type": "string", "description": "YYYY-MM-DD for multi-day, optional"},
            "kind": {"type": "string", "description": "HOLIDAY|SICK|INJURED, default HOLIDAY"},
            "note": {"type": "string"},
        },
        ["start_date"],
    ),
    _tool(
        "move_event",
        "Reschedule an event to a new date. Use for 'move today's workout to tomorrow'.",
        {
            "event_id": {"type": "string"},
            "start_date": {"type": "string", "description": "New date YYYY-MM-DD"},
        },
        ["event_id", "start_date"],
    ),
    _tool(
        "update_event",
        "Rename or otherwise edit an event's simple fields (name, date).",
        {
            "event_id": {"type": "string"},
            "name": {"type": "string"},
            "start_date": {"type": "string", "description": "YYYY-MM-DD"},
        },
        ["event_id"],
    ),
    _tool(
        "mark_done",
        "Mark a planned event as completed.",
        {"event_id": {"type": "string"}},
        ["event_id"],
    ),
    _tool(
        "delete_event",
        "Delete an event from the calendar.",
        {"event_id": {"type": "string"}},
        ["event_id"],
    ),
    _tool(
        "create_custom_workout",
        "Create (and optionally schedule) a custom workout. Use for 'add a Z2 ride tomorrow'. "
        "Steps are simplified dicts: {duration: seconds, power: percent-of-ftp}.",
        {
            "name": {"type": "string"},
            "workout_type": {"type": "string", "description": "Ride|Run|Swim etc, default Ride"},
            "steps": {
                "type": "array",
                "description": "List of {duration: seconds, power: %ftp}",
                "items": {"type": "object"},
            },
            "schedule_date": {"type": "string", "description": "YYYY-MM-DD to schedule it"},
            "description": {"type": "string"},
        },
        ["name", "steps"],
    ),
    _tool(
        "extend_workout",
        "Extend an existing planned workout by appending or prepending steady work "
        "(e.g. add 60 min of Z2). Use for 'extend tomorrow's workout by an hour of Z2'.",
        {
            "event_id": {"type": "string"},
            "minutes": {"type": "integer", "description": "Minutes of work to add"},
            "power_pct": {"type": "integer", "description": "Power as %FTP, default 65 (Z2)"},
            "position": {"type": "string", "description": "append|prepend, default append"},
        },
        ["event_id", "minutes"],
    ),
    _tool(
        "combine_workouts",
        "Merge two days' workouts into one. Concatenates the second event's steps onto "
        "the first, then deletes the second. Use for 'combine today's intervals with "
        "tomorrow's long ride'.",
        {
            "primary_event_id": {"type": "string", "description": "Event to keep and extend"},
            "secondary_event_id": {"type": "string", "description": "Event merged in, then deleted"},
        },
        ["primary_event_id", "secondary_event_id"],
    ),
]


# ─── DeepSeek routing ───────────────────────────────────────────────────────────


def _system_prompt(today: str) -> str:
    weekday = date.fromisoformat(today).strftime("%A")
    return (
        f"You are a command router for a cycling-coaching app. Today is {today} ({weekday}). "
        "Map the athlete's free-text command to one or more tool calls from the provided tools. "
        "Resolve relative dates ('today', 'tomorrow', 'this week', 'next Monday') to YYYY-MM-DD "
        "using today's date. 'This week' means today through the coming Sunday. "
        "For commands that reference 'today's workout' or 'tomorrow's ride' by description rather "
        "than id, FIRST call list_events to find the event, but only if you cannot otherwise act. "
        "Prefer the most direct single tool. If nothing matches, do not call any tool. Be terse."
    )


async def interpret_command(text: str, today_date: str | None = None) -> dict[str, Any]:
    """Route a free-text command to tool calls via DeepSeek.

    Returns a proposal dict:
        {intent_summary, actions: [{tool, args, kind}], needs_confirm}

    needs_confirm is True if any action is a write. On DeepSeek failure or no match,
    returns {intent_summary, actions: [], needs_confirm: False}.
    """
    today = today_date or date.today().isoformat()
    messages = [
        {"role": "system", "content": _system_prompt(today)},
        {"role": "user", "content": text},
    ]

    try:
        resp = await chat_completion(messages, tools=TOOL_CATALOG, tool_choice="auto")
    except Exception as e:
        logger.warning("deepseek routing failed: %s", e)
        return {"intent_summary": "I couldn't map that to an action", "actions": [], "needs_confirm": False}

    choice = resp.get("choices", [{}])[0].get("message", {})
    tool_calls = choice.get("tool_calls") or []

    actions: list[dict[str, Any]] = []
    for call in tool_calls:
        fn = call.get("function", {})
        name = fn.get("name")
        if name not in {a["function"]["name"] for a in TOOL_CATALOG}:
            continue
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except (json.JSONDecodeError, TypeError):
            args = {}
        kind = "write" if name in WRITE_TOOLS else "read"
        actions.append({"tool": name, "args": args, "kind": kind})

    if not actions:
        summary = (choice.get("content") or "").strip() or "I couldn't map that to an action"
        return {"intent_summary": summary, "actions": [], "needs_confirm": False}

    needs_confirm = any(a["kind"] == "write" for a in actions)
    return {
        "intent_summary": _proposal_summary(actions),
        "actions": actions,
        "needs_confirm": needs_confirm,
    }


def _proposal_summary(actions: list[dict[str, Any]]) -> str:
    return "; ".join(_describe_action(a) for a in actions)


def _describe_action(action: dict[str, Any]) -> str:
    """Human-readable one-liner for an action (used in confirm previews)."""
    tool = action["tool"]
    args = action.get("args", {})
    if tool == "create_time_off":
        span = args.get("start_date", "")
        if args.get("end_date"):
            span += f" → {args['end_date']}"
        return f"Block {args.get('kind', 'HOLIDAY').lower()} time off on {span}"
    if tool == "move_event":
        return f"Move event {args.get('event_id')} to {args.get('start_date')}"
    if tool == "update_event":
        bits = [f"name → '{args['name']}'"] if args.get("name") else []
        if args.get("start_date"):
            bits.append(f"date → {args['start_date']}")
        return f"Update event {args.get('event_id')} ({', '.join(bits) or 'edit'})"
    if tool == "mark_done":
        return f"Mark event {args.get('event_id')} done"
    if tool == "delete_event":
        return f"Delete event {args.get('event_id')}"
    if tool == "create_custom_workout":
        when = f" on {args['schedule_date']}" if args.get("schedule_date") else ""
        return f"Create workout '{args.get('name')}'{when}"
    if tool == "extend_workout":
        pos = args.get("position", "append")
        return f"Extend event {args.get('event_id')}: {pos} {args.get('minutes')} min @ {args.get('power_pct', Z2_PCT)}% FTP"
    if tool == "combine_workouts":
        return f"Combine event {args.get('secondary_event_id')} into {args.get('primary_event_id')} (then delete the second)"
    return f"{tool}({args})"


# ─── Execution ──────────────────────────────────────────────────────────────────


async def execute_actions(actions: list[dict[str, Any]]) -> dict[str, Any]:
    """Run each action against its mapped service function.

    Returns {results: [{tool, ok, summary, data?}], executed: True}.
    Per-action errors are caught and reported (ok=False) so one bad arg doesn't
    abort the batch.
    """
    results: list[dict[str, Any]] = []
    for action in actions:
        tool = action.get("tool")
        args = action.get("args", {}) or {}
        try:
            summary, data = await _run_action(tool, args)
            results.append({"tool": tool, "ok": True, "summary": summary, "data": data})
        except ServiceError as e:
            results.append({"tool": tool, "ok": False, "summary": f"Error: {e.message}", "data": None})
        except Exception as e:  # noqa: BLE001 - surface a clean message, never 500 the batch
            logger.warning("action %s failed: %s", tool, e)
            results.append({"tool": tool, "ok": False, "summary": f"Error: {e}", "data": None})
    return {"results": results, "executed": True}


async def _run_action(tool: str, args: dict[str, Any]) -> tuple[str, Any]:
    """Dispatch a single action. Returns (plain_language_summary, data)."""
    if tool == "list_events":
        evs = await events_svc.list_events(oldest=args.get("oldest"), newest=args.get("newest"))
        return _summarize_events(evs), evs
    if tool == "search_library":
        rows = await library_svc.search_library_workouts(
            zone_focus=args.get("zone_focus"),
            name_search=args.get("name_search"),
            duration_min_minutes=args.get("duration_min_minutes"),
            duration_max_minutes=args.get("duration_max_minutes"),
            limit=args.get("limit", 10),
        )
        names = ", ".join(r.get("name", "?") for r in rows[:5])
        return (f"Found {len(rows)} workout(s): {names}" if rows else "No matching workouts."), rows
    if tool == "find_alternatives":
        rows = await library_svc.find_alternatives(
            tr_workout_id=str(args["tr_workout_id"]),
            adjustment=args.get("adjustment"),
            target_zone=args.get("target_zone"),
            max_duration_minutes=args.get("max_duration_minutes"),
        )
        names = ", ".join(r.get("name", "?") for r in rows[:5])
        return (f"{len(rows)} alternative(s): {names}" if rows else "No alternatives found."), rows
    if tool == "get_compliance":
        comp = await events_svc.get_compliance(str(args["event_id"]))
        verdict = comp["compliance"]["verdict"]
        return f"Compliance for event {args['event_id']}: {verdict}", comp
    if tool == "get_coaching_state":
        state = await coaching_svc.coaching_state(zone=args.get("zone", "threshold"))
        return _summarize_coaching(state), state
    if tool == "get_dashboard":
        dash = await coaching_svc.dashboard()
        return _summarize_dashboard(dash), dash

    if tool == "create_time_off":
        ev = await events_svc.create_time_off(
            start_date=args["start_date"],
            end_date=args.get("end_date"),
            kind=args.get("kind", "HOLIDAY"),
            note=args.get("note"),
        )
        return f"Time off created ({args['start_date']}).", ev
    if tool == "move_event":
        ev = await events_svc.move_event(str(args["event_id"]), args["start_date"])
        return f"Moved '{ev.get('name', args['event_id'])}' to {args['start_date']}.", ev
    if tool == "update_event":
        payload: dict[str, Any] = {}
        if args.get("name"):
            payload["name"] = args["name"]
        if args.get("start_date"):
            payload["start_date_local"] = f"{args['start_date']}T00:00:00"
        if not payload:
            raise ServiceError(400, "Nothing to update (provide name or start_date).")
        ev = await events_svc.update_event(str(args["event_id"]), payload)
        return f"Updated event {args['event_id']}.", ev
    if tool == "mark_done":
        ev = await events_svc.mark_done(str(args["event_id"]))
        return f"Marked event {args['event_id']} done.", ev
    if tool == "delete_event":
        res = await events_svc.delete_event(str(args["event_id"]))
        return f"Deleted event {args['event_id']}.", res
    if tool == "create_custom_workout":
        res = await library_svc.create_custom_workout_svc(
            name=args["name"],
            workout_type=args.get("workout_type", "Ride"),
            steps=args["steps"],
            description=args.get("description"),
            schedule_date=args.get("schedule_date"),
        )
        when = f" scheduled {args['schedule_date']}" if args.get("schedule_date") and res.get("scheduled") else ""
        return f"Created workout '{args['name']}'{when}.", res
    if tool == "extend_workout":
        return await extend_workout(
            str(args["event_id"]),
            minutes=int(args["minutes"]),
            power_pct=int(args.get("power_pct", Z2_PCT)),
            position=args.get("position", "append"),
        )
    if tool == "combine_workouts":
        return await combine_workouts(
            str(args["primary_event_id"]), str(args["secondary_event_id"])
        )

    raise ServiceError(400, f"Unknown tool '{tool}'")


# ─── Composite workout_doc surgery ──────────────────────────────────────────────


def append_step(doc: dict[str, Any], step: dict[str, Any], position: str = "append") -> dict[str, Any]:
    """Return a copy of a workout_doc with a step appended or prepended."""
    new_doc = dict(doc)
    steps = list(doc.get("steps") or [])
    if position == "prepend":
        steps = [step, *steps]
    else:
        steps = [*steps, step]
    new_doc["steps"] = steps
    return new_doc


def _z_step(minutes: int, power_pct: int) -> dict[str, Any]:
    """Build a single steady-power workout_doc step."""
    return {
        "duration": minutes * 60,
        "power": {"value": power_pct, "units": "%ftp"},
        "text": f"Z2 {minutes}min" if power_pct == Z2_PCT else f"{minutes}min @ {power_pct}%",
    }


async def extend_workout(
    event_id: str, minutes: int, power_pct: int = Z2_PCT, position: str = "append"
) -> tuple[str, Any]:
    """Append/prepend a steady block to a planned workout's workout_doc and PUT it back.

    Raises ServiceError if the event has no structured workout_doc.
    """
    if minutes <= 0:
        raise ServiceError(400, "minutes must be positive")
    event = await events_svc.get_event(event_id)
    doc = event.get("workout_doc")
    if not isinstance(doc, dict) or not doc.get("steps"):
        raise ServiceError(400, f"Event {event_id} has no structured workout to extend.")

    new_doc = append_step(doc, _z_step(minutes, power_pct), position)
    updated = await events_svc.update_event(event_id, {"workout_doc": new_doc})
    return (
        f"Extended '{event.get('name', event_id)}' by {minutes} min @ {power_pct}% FTP ({position}).",
        updated,
    )


async def combine_workouts(primary_event_id: str, secondary_event_id: str) -> tuple[str, Any]:
    """Merge secondary event's steps onto the primary, then delete the secondary.

    Both events must have structured workout_docs. The primary is PUT with the
    concatenated steps; the secondary is deleted.
    """
    primary = await events_svc.get_event(primary_event_id)
    secondary = await events_svc.get_event(secondary_event_id)

    primary_doc = primary.get("workout_doc")
    secondary_doc = secondary.get("workout_doc")
    if not isinstance(primary_doc, dict) or not primary_doc.get("steps"):
        raise ServiceError(400, f"Primary event {primary_event_id} has no structured workout.")
    if not isinstance(secondary_doc, dict) or not secondary_doc.get("steps"):
        raise ServiceError(400, f"Secondary event {secondary_event_id} has no structured workout.")

    merged = dict(primary_doc)
    merged["steps"] = [*primary_doc["steps"], *secondary_doc["steps"]]

    updated = await events_svc.update_event(primary_event_id, {"workout_doc": merged})
    await events_svc.delete_event(secondary_event_id)
    return (
        f"Combined '{secondary.get('name', secondary_event_id)}' into "
        f"'{primary.get('name', primary_event_id)}' and removed the second.",
        updated,
    )


# ─── Read summaries ─────────────────────────────────────────────────────────────


def _summarize_events(events: list[dict[str, Any]]) -> str:
    if not events:
        return "No events in that range."
    lines = []
    for e in events[:10]:
        day = (e.get("start_date_local") or e.get("start_date") or "")[:10]
        lines.append(f"{day}: {e.get('name', '?')} ({e.get('category', '')})")
    extra = "" if len(events) <= 10 else f" (+{len(events) - 10} more)"
    return "; ".join(lines) + extra


def _summarize_coaching(state: dict[str, Any]) -> str:
    readiness = state.get("readiness") or {}
    verdict = readiness.get("verdict") or readiness.get("state") or "unknown"
    patterns = state.get("patterns") or {}
    active = patterns.get("active") if isinstance(patterns, dict) else None
    pat_txt = f", {len(active)} active pattern(s)" if active else ""
    return f"Readiness: {verdict}{pat_txt}."


def _summarize_dashboard(dash: dict[str, Any]) -> str:
    nxt = dash.get("next_workout") or {}
    nxt_txt = nxt.get("name", "none") if nxt else "none"
    latest = dash.get("latest_activity") or {}
    latest_txt = latest.get("name", "none") if latest else "none"
    readiness = dash.get("readiness") or {}
    verdict = readiness.get("verdict") or readiness.get("state") or "unknown" if readiness else "unknown"
    return f"Next workout: {nxt_txt}. Latest activity: {latest_txt}. Readiness: {verdict}."
