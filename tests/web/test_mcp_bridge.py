"""
Tests for the MCP parity bridge routes.

GET /api/mcp/tools  → list of {"name": ..., "description": ...}
POST /api/mcp/{tool_name} → {"result": "<string>"} or error
"""

import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg

    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app

    return TestClient(create_app())


# ---------------------------------------------------------------------------
# _extract_text unit tests
# ---------------------------------------------------------------------------


def test_extract_text_plain_string():
    from intervals_mcp_server.web.routes.mcp_bridge import _extract_text

    assert _extract_text("hello world") == "hello world"


def test_extract_text_list_of_content_objects():
    from intervals_mcp_server.web.routes.mcp_bridge import _extract_text

    class FakeContent:
        def __init__(self, text):
            self.text = text

    result = [FakeContent("foo"), FakeContent("bar")]
    assert _extract_text(result) == "foo\nbar"


def test_extract_text_tuple_content_list_first():
    from intervals_mcp_server.web.routes.mcp_bridge import _extract_text

    class FakeContent:
        def __init__(self, text):
            self.text = text

    content_list = [FakeContent("baz")]
    result = (content_list, {"result": "baz"})
    assert _extract_text(result) == "baz"


def test_extract_text_fallback_to_str():
    from intervals_mcp_server.web.routes.mcp_bridge import _extract_text

    assert _extract_text(42) == "42"
    assert _extract_text({"key": "val"}) == str({"key": "val"})


def test_extract_text_empty_list():
    from intervals_mcp_server.web.routes.mcp_bridge import _extract_text

    assert _extract_text([]) == ""


# ---------------------------------------------------------------------------
# GET /api/mcp/tools
# ---------------------------------------------------------------------------


def test_get_tools_returns_list(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/mcp/tools")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    # Every item has name and description
    for item in data:
        assert "name" in item
        assert "description" in item


def test_get_tools_contains_known_tool(monkeypatch):
    c = _client(monkeypatch)
    r = c.get("/api/mcp/tools")
    names = [item["name"] for item in r.json()]
    assert "get_activities" in names


def test_get_tools_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg

    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app

    c = TestClient(create_app())
    r = c.get("/api/mcp/tools")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/mcp/{tool_name}
# ---------------------------------------------------------------------------


def test_post_tool_unknown_returns_404(monkeypatch):
    c = _client(monkeypatch)
    r = c.post("/api/mcp/nonexistent_tool", json={})
    assert r.status_code == 404
    assert r.json()["error"] is True
    assert "nonexistent_tool" in r.json()["message"]


def test_post_tool_get_activities_200(monkeypatch):
    sample = {
        "name": "Morning Ride",
        "id": 123,
        "type": "Ride",
        "startTime": "2024-01-01T08:00:00Z",
        "distance": 1000,
        "duration": 3600,
    }

    async def fake_request(*_args, **_kwargs):
        return [sample]

    monkeypatch.setattr("intervals_mcp_server.api.client.make_intervals_request", fake_request)
    monkeypatch.setattr(
        "intervals_mcp_server.tools.activities.make_intervals_request", fake_request
    )

    c = _client(monkeypatch)
    r = c.post("/api/mcp/get_activities", json={"limit": 1, "include_unnamed": True})
    assert r.status_code == 200
    body = r.json()
    assert "result" in body
    assert "Morning Ride" in body["result"]


def test_post_tool_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg

    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app

    c = TestClient(create_app())
    r = c.post("/api/mcp/get_activities", json={})
    assert r.status_code == 401
