import json
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services import command as cmd
from intervals_mcp_server.services.errors import ServiceError


def _tool_call(name: str, args: dict) -> dict:
    return {"function": {"name": name, "arguments": json.dumps(args)}}


def _deepseek_resp(tool_calls=None, content=""):
    return {"choices": [{"message": {"content": content, "tool_calls": tool_calls or None}}]}


# ─── interpret_command: read → executes, write → needs_confirm ──────────────────


@pytest.mark.asyncio
async def test_interpret_read_action_not_confirm(monkeypatch):
    async def fake_chat(messages, **kwargs):
        return _deepseek_resp([_tool_call("get_dashboard", {})])

    monkeypatch.setattr("intervals_mcp_server.services.command.chat_completion", fake_chat)
    out = await cmd.interpret_command("how's my training", today_date="2026-06-26")
    assert out["needs_confirm"] is False
    assert out["actions"][0] == {"tool": "get_dashboard", "args": {}, "kind": "read"}


@pytest.mark.asyncio
async def test_interpret_write_action_needs_confirm(monkeypatch):
    async def fake_chat(messages, **kwargs):
        return _deepseek_resp([_tool_call("create_time_off", {"start_date": "2026-06-29"})])

    monkeypatch.setattr("intervals_mcp_server.services.command.chat_completion", fake_chat)
    out = await cmd.interpret_command("time off monday", today_date="2026-06-26")
    assert out["needs_confirm"] is True
    assert out["actions"][0]["tool"] == "create_time_off"
    assert out["actions"][0]["kind"] == "write"


@pytest.mark.asyncio
async def test_interpret_no_match(monkeypatch):
    async def fake_chat(messages, **kwargs):
        return _deepseek_resp([], content="no")

    monkeypatch.setattr("intervals_mcp_server.services.command.chat_completion", fake_chat)
    out = await cmd.interpret_command("what's the weather", today_date="2026-06-26")
    assert out["actions"] == []
    assert out["needs_confirm"] is False


@pytest.mark.asyncio
async def test_interpret_deepseek_failure(monkeypatch):
    async def fake_chat(messages, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr("intervals_mcp_server.services.command.chat_completion", fake_chat)
    out = await cmd.interpret_command("anything", today_date="2026-06-26")
    assert out["actions"] == []
    assert "couldn't map" in out["intent_summary"]


# ─── execute_actions: dispatches to mapped service fn ───────────────────────────


@pytest.mark.asyncio
async def test_execute_read_dashboard(monkeypatch):
    async def fake_dashboard():
        return {"next_workout": {"name": "Threshold"}, "latest_activity": {"name": "Z2"}, "readiness": {"verdict": "green"}}

    monkeypatch.setattr("intervals_mcp_server.services.command.coaching_svc.dashboard", fake_dashboard)
    out = await cmd.execute_actions([{"tool": "get_dashboard", "args": {}, "kind": "read"}])
    assert out["executed"] is True
    assert out["results"][0]["ok"] is True
    assert "Threshold" in out["results"][0]["summary"]


@pytest.mark.asyncio
async def test_execute_write_create_time_off(monkeypatch):
    captured = {}

    async def fake_time_off(start_date, end_date=None, kind="HOLIDAY", note=None, athlete_id=None):
        captured["start_date"] = start_date
        captured["kind"] = kind
        return {"id": "to1", "name": "Time off"}

    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.create_time_off", fake_time_off)
    out = await cmd.execute_actions(
        [{"tool": "create_time_off", "args": {"start_date": "2026-06-29", "kind": "SICK"}, "kind": "write"}]
    )
    assert out["results"][0]["ok"] is True
    assert captured == {"start_date": "2026-06-29", "kind": "SICK"}


@pytest.mark.asyncio
async def test_execute_bad_args_reports_error(monkeypatch):
    out = await cmd.execute_actions([{"tool": "move_event", "args": {}, "kind": "write"}])
    assert out["results"][0]["ok"] is False
    assert "Error" in out["results"][0]["summary"]


@pytest.mark.asyncio
async def test_execute_unknown_tool(monkeypatch):
    out = await cmd.execute_actions([{"tool": "nope", "args": {}, "kind": "read"}])
    assert out["results"][0]["ok"] is False


# ─── workout_doc surgery ────────────────────────────────────────────────────────


def test_append_step_append():
    doc = {"steps": [{"duration": 600, "power": {"value": 50, "units": "%ftp"}}]}
    step = cmd._z_step(60, 65)
    new = cmd.append_step(doc, step, "append")
    assert len(new["steps"]) == 2
    assert new["steps"][-1]["duration"] == 3600
    assert new["steps"][-1]["power"] == {"value": 65, "units": "%ftp"}
    # original untouched
    assert len(doc["steps"]) == 1


def test_append_step_prepend():
    doc = {"steps": [{"duration": 600}]}
    new = cmd.append_step(doc, cmd._z_step(30, 65), "prepend")
    assert new["steps"][0]["duration"] == 1800


def test_z_step_math():
    step = cmd._z_step(90, 65)
    assert step["duration"] == 90 * 60
    assert step["power"]["value"] == 65


@pytest.mark.asyncio
async def test_extend_workout_appends_and_puts(monkeypatch):
    put_calls = {}

    async def fake_get(event_id, athlete_id=None):
        return {"id": event_id, "name": "Sweet Spot", "workout_doc": {"steps": [{"duration": 1200, "power": {"value": 88, "units": "%ftp"}}]}}

    async def fake_update(event_id, payload, athlete_id=None):
        put_calls["doc"] = payload["workout_doc"]
        return {"id": event_id, **payload}

    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.get_event", fake_get)
    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.update_event", fake_update)

    summary, _ = await cmd.extend_workout("ev1", minutes=60, power_pct=65)
    assert "Extended" in summary
    assert len(put_calls["doc"]["steps"]) == 2
    assert put_calls["doc"]["steps"][-1]["duration"] == 3600


@pytest.mark.asyncio
async def test_extend_workout_no_doc_raises(monkeypatch):
    async def fake_get(event_id, athlete_id=None):
        return {"id": event_id, "name": "Race"}

    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.get_event", fake_get)
    with pytest.raises(ServiceError):
        await cmd.extend_workout("ev1", minutes=60)


@pytest.mark.asyncio
async def test_combine_workouts_merges_and_deletes(monkeypatch):
    state = {}

    async def fake_get(event_id, athlete_id=None):
        docs = {
            "p": {"id": "p", "name": "Intervals", "workout_doc": {"steps": [{"duration": 300}, {"duration": 300}]}},
            "s": {"id": "s", "name": "Long Ride", "workout_doc": {"steps": [{"duration": 3600}]}},
        }
        return docs[event_id]

    async def fake_update(event_id, payload, athlete_id=None):
        state["merged"] = payload["workout_doc"]
        return {"id": event_id, **payload}

    async def fake_delete(event_id, athlete_id=None):
        state["deleted"] = event_id
        return {"deleted": event_id}

    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.get_event", fake_get)
    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.update_event", fake_update)
    monkeypatch.setattr("intervals_mcp_server.services.command.events_svc.delete_event", fake_delete)

    summary, _ = await cmd.combine_workouts("p", "s")
    assert len(state["merged"]["steps"]) == 3
    assert state["deleted"] == "s"
    assert "Combined" in summary
