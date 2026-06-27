import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

from fastapi.testclient import TestClient


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


def test_command_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/command", json={"text": "hi"})
    assert r.status_code == 401


def test_command_read_executes(monkeypatch):
    async def fake_interpret(text, today_date=None):
        return {"intent_summary": "Overview", "actions": [{"tool": "get_dashboard", "args": {}, "kind": "read"}], "needs_confirm": False}

    async def fake_execute(actions):
        return {"results": [{"tool": "get_dashboard", "ok": True, "summary": "Next: X", "data": {}}], "executed": True}

    monkeypatch.setattr("intervals_mcp_server.web.routes.command.interpret_command", fake_interpret)
    monkeypatch.setattr("intervals_mcp_server.web.routes.command.execute_actions", fake_execute)
    c = _client(monkeypatch)
    r = c.post("/api/command", json={"text": "how's my training"})
    assert r.status_code == 200
    body = r.json()
    assert body["executed"] is True
    assert body["results"][0]["summary"] == "Next: X"
    # executed-read summary is derived from result summaries, not the raw tool signature
    assert body["summary"] == "Next: X"


def test_command_write_previews_without_executing(monkeypatch):
    calls = {"executed": 0}

    async def fake_interpret(text, today_date=None):
        return {
            "intent_summary": "Block time off",
            "actions": [{"tool": "create_time_off", "args": {"start_date": "2026-06-29"}, "kind": "write"}],
            "needs_confirm": True,
        }

    async def fake_execute(actions):
        calls["executed"] += 1
        return {"results": [], "executed": True}

    monkeypatch.setattr("intervals_mcp_server.web.routes.command.interpret_command", fake_interpret)
    monkeypatch.setattr("intervals_mcp_server.web.routes.command.execute_actions", fake_execute)
    c = _client(monkeypatch)
    r = c.post("/api/command", json={"text": "time off monday"})
    assert r.status_code == 200
    body = r.json()
    assert body["executed"] is False
    assert body["needs_confirm"] is True
    assert body["proposed_actions"][0]["tool"] == "create_time_off"
    assert calls["executed"] == 0  # NOT executed at interpret time


def test_command_execute_runs_actions(monkeypatch):
    captured = {}

    async def fake_execute(actions):
        captured["actions"] = actions
        return {"results": [{"tool": "create_time_off", "ok": True, "summary": "Done", "data": {}}], "executed": True}

    monkeypatch.setattr("intervals_mcp_server.web.routes.command.execute_actions", fake_execute)
    c = _client(monkeypatch)
    actions = [{"tool": "create_time_off", "args": {"start_date": "2026-06-29"}, "kind": "write"}]
    r = c.post("/api/command/execute", json={"actions": actions})
    assert r.status_code == 200
    assert r.json()["executed"] is True
    assert captured["actions"] == actions


def test_command_no_match(monkeypatch):
    async def fake_interpret(text, today_date=None):
        return {"intent_summary": "I couldn't map that to an action", "actions": [], "needs_confirm": False}

    monkeypatch.setattr("intervals_mcp_server.web.routes.command.interpret_command", fake_interpret)
    c = _client(monkeypatch)
    r = c.post("/api/command", json={"text": "blah"})
    assert r.status_code == 200
    body = r.json()
    assert body["actions"] == []
    assert body["executed"] is False
