import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_EVENT = {
    "id": "ev1",
    "name": "Morning Ride",
    "type": "Ride",
    "start_date_local": "2024-01-15T00:00:00",
    "category": "WORKOUT",
}

SAMPLE_EVENT_LIST = [SAMPLE_EVENT]


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- 401 auth gate ---

def test_events_list_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/events")
    assert r.status_code == 401


# --- GET /api/events ---

def test_events_list_200(monkeypatch):
    async def fake_list(oldest=None, newest=None, athlete_id=None):
        return SAMPLE_EVENT_LIST

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_events", fake_list
    )
    c = _client(monkeypatch)
    r = c.get("/api/events")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Morning Ride"


def test_events_list_passes_query_params(monkeypatch):
    captured = {}

    async def fake_list(oldest=None, newest=None, athlete_id=None):
        captured["oldest"] = oldest
        captured["newest"] = newest
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_events", fake_list
    )
    c = _client(monkeypatch)
    c.get("/api/events?oldest=2024-01-01&newest=2024-01-31")
    assert captured["oldest"] == "2024-01-01"
    assert captured["newest"] == "2024-01-31"


def test_events_list_service_error(monkeypatch):
    async def fake_list(oldest=None, newest=None, athlete_id=None):
        raise ServiceError(502, "upstream down")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_events", fake_list
    )
    c = _client(monkeypatch)
    r = c.get("/api/events")
    assert r.status_code == 502
    assert r.json()["error"] is True
    assert "upstream down" in r.json()["message"]


# --- GET /api/events/{event_id} ---

def test_get_event_200(monkeypatch):
    async def fake_get(event_id, athlete_id=None):
        return SAMPLE_EVENT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.get_event", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/events/ev1")
    assert r.status_code == 200
    assert r.json()["id"] == "ev1"


def test_get_event_404(monkeypatch):
    async def fake_get(event_id, athlete_id=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.get_event", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/events/missing")
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- POST /api/events ---

def test_create_event_200(monkeypatch):
    async def fake_create(payload, athlete_id=None):
        return {**SAMPLE_EVENT, **payload}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_event", fake_create
    )
    c = _client(monkeypatch)
    body = {"name": "New Ride", "type": "Ride", "start_date_local": "2024-03-01T00:00:00"}
    r = c.post("/api/events", json=body)
    assert r.status_code == 200
    assert r.json()["name"] == "New Ride"


def test_create_event_with_start_date_conversion(monkeypatch):
    """Route passes body through; service handles start_date→start_date_local."""
    captured = {}

    async def fake_create(payload, athlete_id=None):
        captured["payload"] = payload
        return SAMPLE_EVENT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_event", fake_create
    )
    c = _client(monkeypatch)
    body = {"name": "Ride", "type": "Ride", "start_date": "2024-03-01"}
    c.post("/api/events", json=body)
    assert captured["payload"]["start_date"] == "2024-03-01"


def test_create_event_service_error(monkeypatch):
    async def fake_create(payload, athlete_id=None):
        raise ServiceError(400, "bad request")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_event", fake_create
    )
    c = _client(monkeypatch)
    r = c.post("/api/events", json={"name": "X", "type": "Ride", "start_date_local": "2024-01-01T00:00:00"})
    assert r.status_code == 400
    assert r.json()["error"] is True


# --- PUT /api/events/{event_id} ---

def test_update_event_200(monkeypatch):
    async def fake_update(event_id, payload, athlete_id=None):
        return {**SAMPLE_EVENT, **payload}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.update_event", fake_update
    )
    c = _client(monkeypatch)
    r = c.put("/api/events/ev1", json={"name": "Updated Ride"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated Ride"


def test_update_event_service_error(monkeypatch):
    async def fake_update(event_id, payload, athlete_id=None):
        raise ServiceError(403, "forbidden")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.update_event", fake_update
    )
    c = _client(monkeypatch)
    r = c.put("/api/events/ev1", json={"name": "X"})
    assert r.status_code == 403
    assert r.json()["error"] is True


# --- DELETE /api/events/{event_id} ---

def test_delete_event_200(monkeypatch):
    async def fake_delete(event_id, athlete_id=None):
        return {"deleted": event_id}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.delete_event", fake_delete
    )
    c = _client(monkeypatch)
    r = c.delete("/api/events/ev1")
    assert r.status_code == 200
    assert r.json() == {"deleted": "ev1"}


def test_delete_event_service_error(monkeypatch):
    async def fake_delete(event_id, athlete_id=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.delete_event", fake_delete
    )
    c = _client(monkeypatch)
    r = c.delete("/api/events/ev99")
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- POST /api/events/{event_id}/move ---

def test_move_event_200(monkeypatch):
    async def fake_move(event_id, start_date, athlete_id=None):
        return {**SAMPLE_EVENT, "start_date_local": f"{start_date}T00:00:00"}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.move_event", fake_move
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/move", json={"start_date": "2024-02-10"})
    assert r.status_code == 200
    assert r.json()["start_date_local"] == "2024-02-10T00:00:00"


def test_move_event_passes_start_date(monkeypatch):
    captured = {}

    async def fake_move(event_id, start_date, athlete_id=None):
        captured["event_id"] = event_id
        captured["start_date"] = start_date
        return SAMPLE_EVENT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.move_event", fake_move
    )
    c = _client(monkeypatch)
    c.post("/api/events/ev42/move", json={"start_date": "2024-03-15"})
    assert captured["event_id"] == "ev42"
    assert captured["start_date"] == "2024-03-15"


def test_move_event_service_error(monkeypatch):
    async def fake_move(event_id, start_date, athlete_id=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.move_event", fake_move
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev99/move", json={"start_date": "2024-02-10"})
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- POST /api/events/{event_id}/mark-done ---

def test_mark_done_200(monkeypatch):
    async def fake_mark_done(event_id, athlete_id=None):
        return {"id": "act123"}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.mark_done", fake_mark_done
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/mark-done")
    assert r.status_code == 200
    assert r.json()["id"] == "act123"


def test_mark_done_service_error(monkeypatch):
    async def fake_mark_done(event_id, athlete_id=None):
        raise ServiceError(500, "server error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.mark_done", fake_mark_done
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/mark-done")
    assert r.status_code == 500
    assert r.json()["error"] is True
