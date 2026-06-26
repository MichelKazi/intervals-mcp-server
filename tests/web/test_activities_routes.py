import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_ACTIVITIES = [
    {"id": "abc123", "name": "Morning Ride", "type": "Ride"},
]

SAMPLE_ACTIVITY = {"id": "abc123", "name": "Morning Ride", "type": "Ride"}

SAMPLE_INTERVALS = {
    "icu_intervals": [{"id": 1, "name": "Warmup"}],
    "icu_groups": [],
}

SAMPLE_STREAMS = [
    {"type": "time", "data": [0, 1, 2]},
]


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- GET /api/activities ---

def test_list_activities_200(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return SAMPLE_ACTIVITIES

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.list_activities", fake_list
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Morning Ride"


def test_list_activities_service_error(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        raise ServiceError(502, "upstream down")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.list_activities", fake_list
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities")
    assert r.status_code == 502
    assert r.json()["error"] is True
    assert "upstream down" in r.json()["message"]


def test_list_activities_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/activities")
    assert r.status_code == 401


# --- GET /api/activities/{activity_id} ---

def test_get_activity_200(monkeypatch):
    async def fake_get(activity_id):
        return SAMPLE_ACTIVITY

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_activity", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/abc123")
    assert r.status_code == 200
    assert r.json()["id"] == "abc123"


def test_get_activity_404(monkeypatch):
    async def fake_get(activity_id):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_activity", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/missing")
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- GET /api/activities/{activity_id}/intervals ---

def test_get_intervals_200(monkeypatch):
    async def fake_get_intervals(activity_id):
        return SAMPLE_INTERVALS

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_intervals", fake_get_intervals
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/abc123/intervals")
    assert r.status_code == 200
    assert "icu_intervals" in r.json()


def test_get_intervals_service_error(monkeypatch):
    async def fake_get_intervals(activity_id):
        raise ServiceError(500, "server error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_intervals", fake_get_intervals
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/abc123/intervals")
    assert r.status_code == 500
    assert r.json()["error"] is True


# --- GET /api/activities/{activity_id}/streams ---

def test_get_streams_200(monkeypatch):
    async def fake_get_streams(activity_id, types=None):
        return SAMPLE_STREAMS

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_streams", fake_get_streams
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/abc123/streams")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["type"] == "time"


def test_get_streams_with_types_param(monkeypatch):
    captured = {}

    async def fake_get_streams(activity_id, types=None):
        captured["types"] = types
        return SAMPLE_STREAMS

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_streams", fake_get_streams
    )
    c = _client(monkeypatch)
    c.get("/api/activities/abc123/streams?types=time,watts")
    assert captured.get("types") == "time,watts"


def test_get_streams_service_error(monkeypatch):
    async def fake_get_streams(activity_id, types=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.activities.get_streams", fake_get_streams
    )
    c = _client(monkeypatch)
    r = c.get("/api/activities/abc123/streams")
    assert r.status_code == 404
    assert r.json()["error"] is True
