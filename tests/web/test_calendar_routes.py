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


# --- POST /api/events/{event_id}/pair ---

def test_pair_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/events/ev1/pair", json={"activity_id": 123})
    assert r.status_code == 401


def test_pair_200(monkeypatch):
    captured = {}

    async def fake_pair(event_id, activity_id, athlete_id=None):
        captured["event_id"] = event_id
        captured["activity_id"] = activity_id
        return {**SAMPLE_EVENT, "paired_activity_id": activity_id}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.pair_activity", fake_pair
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/pair", json={"activity_id": 987654})
    assert r.status_code == 200
    assert r.json()["paired_activity_id"] == 987654
    assert captured["event_id"] == "ev1"
    assert captured["activity_id"] == 987654


def test_pair_service_error(monkeypatch):
    async def fake_pair(event_id, activity_id, athlete_id=None):
        raise ServiceError(403, "forbidden")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.pair_activity", fake_pair
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/pair", json={"activity_id": 1})
    assert r.status_code == 403
    assert r.json()["error"] is True
    assert "forbidden" in r.json()["message"]


# --- POST /api/events/{event_id}/unpair ---

def test_unpair_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/events/ev1/unpair")
    assert r.status_code == 401


def test_unpair_200(monkeypatch):
    async def fake_unpair(event_id, athlete_id=None):
        return {**SAMPLE_EVENT, "paired_activity_id": None}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.unpair_activity", fake_unpair
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev1/unpair")
    assert r.status_code == 200
    assert r.json()["paired_activity_id"] is None


def test_unpair_service_error(monkeypatch):
    async def fake_unpair(event_id, athlete_id=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.unpair_activity", fake_unpair
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/ev99/unpair")
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- GET /api/events/{event_id}/compliance ---

SAMPLE_COMPLIANCE = {
    "event_id": "ev1",
    "paired_activity_id": "i9",
    "paired": True,
    "planned": {"load": 100, "duration": 3600},
    "actual": {"load": 104, "duration": 3700, "intensity": 85},
    "compliance": {"load_pct": 104, "duration_pct": 103, "verdict": "on_target"},
}


def test_compliance_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/events/ev1/compliance")
    assert r.status_code == 401


def test_compliance_200(monkeypatch):
    async def fake_compliance(event_id, athlete_id=None):
        return SAMPLE_COMPLIANCE

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.get_compliance", fake_compliance
    )
    c = _client(monkeypatch)
    r = c.get("/api/events/ev1/compliance")
    assert r.status_code == 200
    data = r.json()
    assert data["event_id"] == "ev1"
    assert data["paired"] is True
    assert data["planned"]["load"] == 100
    assert data["compliance"]["verdict"] == "on_target"


def test_compliance_service_error(monkeypatch):
    async def fake_compliance(event_id, athlete_id=None):
        raise ServiceError(404, "not found")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.get_compliance", fake_compliance
    )
    c = _client(monkeypatch)
    r = c.get("/api/events/missing/compliance")
    assert r.status_code == 404
    assert r.json()["error"] is True


# --- POST /api/events/auto-link ---

def test_auto_link_single_date_200(monkeypatch):
    async def fake_auto_link_day(date, athlete_id=None):
        return {"date": date, "linked": [], "unmatched_workouts": [], "unmatched_activities": []}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.auto_link_day", fake_auto_link_day
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/auto-link", json={"date": "2024-06-01"})
    assert r.status_code == 200
    assert r.json()["date"] == "2024-06-01"


def test_auto_link_range_200(monkeypatch):
    async def fake_auto_link_range(oldest, newest, athlete_id=None):
        return {"oldest": oldest, "newest": newest, "linked": [], "unmatched_workouts": [], "unmatched_activities": []}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.auto_link_range", fake_auto_link_range
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/auto-link", json={"oldest": "2024-06-01", "newest": "2024-06-07"})
    assert r.status_code == 200
    assert r.json()["oldest"] == "2024-06-01"


def test_auto_link_missing_params_400(monkeypatch):
    c = _client(monkeypatch)
    r = c.post("/api/events/auto-link", json={})
    assert r.status_code == 400
    assert r.json()["error"] is True


def test_auto_link_service_error(monkeypatch):
    async def fake_auto_link_day(date, athlete_id=None):
        raise ServiceError(502, "upstream error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.auto_link_day", fake_auto_link_day
    )
    c = _client(monkeypatch)
    r = c.post("/api/events/auto-link", json={"date": "2024-06-01"})
    assert r.status_code == 502
    assert r.json()["error"] is True


# --- POST /api/time-off ---

def test_create_time_off_200(monkeypatch):
    async def fake_create_time_off(start_date, end_date=None, kind="HOLIDAY", note=None, athlete_id=None):
        return {"id": "to1", "category": kind, "name": note or "Time off"}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_time_off", fake_create_time_off
    )
    c = _client(monkeypatch)
    r = c.post("/api/time-off", json={"start_date": "2026-08-15"})
    assert r.status_code == 200
    assert r.json()["id"] == "to1"
    assert r.json()["category"] == "HOLIDAY"


def test_create_time_off_sick_with_note(monkeypatch):
    captured = {}

    async def fake_create_time_off(start_date, end_date=None, kind="HOLIDAY", note=None, athlete_id=None):
        captured["kind"] = kind
        captured["note"] = note
        return {"id": "to2", "category": kind, "name": note}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_time_off", fake_create_time_off
    )
    c = _client(monkeypatch)
    r = c.post("/api/time-off", json={"start_date": "2026-08-10", "kind": "SICK", "note": "Flu"})
    assert r.status_code == 200
    assert captured["kind"] == "SICK"
    assert captured["note"] == "Flu"


def test_create_time_off_service_error(monkeypatch):
    async def fake_create_time_off(start_date, end_date=None, kind="HOLIDAY", note=None, athlete_id=None):
        raise ServiceError(400, "Invalid kind")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.create_time_off", fake_create_time_off
    )
    c = _client(monkeypatch)
    r = c.post("/api/time-off", json={"start_date": "2026-08-15", "kind": "WORKOUT"})
    assert r.status_code == 400
    assert r.json()["error"] is True


def test_create_time_off_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    from fastapi.testclient import TestClient
    c = TestClient(create_app())
    r = c.post("/api/time-off", json={"start_date": "2026-08-15"})
    assert r.status_code == 401


# --- GET /api/time-off ---

def test_list_time_off_200(monkeypatch):
    async def fake_list_time_off(oldest=None, newest=None, athlete_id=None):
        return [{"id": "to1", "category": "HOLIDAY", "name": "Time off"}]

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_time_off", fake_list_time_off
    )
    c = _client(monkeypatch)
    r = c.get("/api/time-off")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["category"] == "HOLIDAY"


def test_list_time_off_passes_query_params(monkeypatch):
    captured = {}

    async def fake_list_time_off(oldest=None, newest=None, athlete_id=None):
        captured["oldest"] = oldest
        captured["newest"] = newest
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_time_off", fake_list_time_off
    )
    c = _client(monkeypatch)
    c.get("/api/time-off?oldest=2026-01-01&newest=2026-12-31")
    assert captured["oldest"] == "2026-01-01"
    assert captured["newest"] == "2026-12-31"


def test_list_time_off_service_error(monkeypatch):
    async def fake_list_time_off(oldest=None, newest=None, athlete_id=None):
        raise ServiceError(502, "upstream error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.calendar.list_time_off", fake_list_time_off
    )
    c = _client(monkeypatch)
    r = c.get("/api/time-off")
    assert r.status_code == 502
    assert r.json()["error"] is True
