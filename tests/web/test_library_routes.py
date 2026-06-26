import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_WORKOUT = {
    "tr_workout_id": "w1",
    "name": "Kaweah",
    "duration_secs": 3600,
    "tss": 75.0,
    "zone_focus": ["threshold"],
    "adaptation_target": "threshold_power",
    "intervals_json": [{"start": 0, "end": 600, "name": "WU", "power_pct": 60}],
}

SAMPLE_ALT = {
    "tr_workout_id": "w2",
    "name": "Mary Austin",
    "duration_secs": 3600,
    "tss": 80.0,
}


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# ---------------------------------------------------------------------------
# GET /api/library/search
# ---------------------------------------------------------------------------

def test_library_search_200(monkeypatch):
    async def fake_search(**kwargs):
        return [SAMPLE_WORKOUT]

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.search_library_workouts", fake_search
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/search")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Kaweah"


def test_library_search_empty(monkeypatch):
    async def fake_search(**kwargs):
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.search_library_workouts", fake_search
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/search")
    assert r.status_code == 200
    assert r.json() == []


def test_library_search_passes_minutes_param(monkeypatch):
    """Verify that duration_min_minutes/duration_max_minutes query params are forwarded."""
    captured = {}

    async def fake_search(**kwargs):
        captured.update(kwargs)
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.search_library_workouts", fake_search
    )
    c = _client(monkeypatch)
    c.get("/api/library/search?duration_min_minutes=30&duration_max_minutes=60")
    assert captured.get("duration_min_minutes") == 30
    assert captured.get("duration_max_minutes") == 60


def test_library_search_service_error(monkeypatch):
    async def fake_search(**kwargs):
        raise ServiceError(503, "Supabase not configured.")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.search_library_workouts", fake_search
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/search")
    assert r.status_code == 503
    assert r.json()["error"] is True


def test_library_search_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/library/search")
    assert r.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/library/alternatives — must NOT be captured as /{tr_workout_id}
# ---------------------------------------------------------------------------

def test_library_alternatives_not_captured_as_path_param(monkeypatch):
    """The route /api/library/alternatives must be distinct from /{tr_workout_id}."""
    async def fake_alts(**kwargs):
        return [SAMPLE_ALT]

    async def fake_get(tr_workout_id):
        # If this is called, the route ordering is wrong
        raise AssertionError("get_library_workout was called — route ordering bug")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.find_alternatives", fake_alts
    )
    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.get_library_workout", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/alternatives?tr_workout_id=w1")
    assert r.status_code == 200
    assert r.json()[0]["name"] == "Mary Austin"


def test_library_alternatives_200(monkeypatch):
    async def fake_alts(**kwargs):
        return [SAMPLE_ALT]

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.find_alternatives", fake_alts
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/alternatives?tr_workout_id=w1&adjustment=shorter")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["tr_workout_id"] == "w2"


def test_library_alternatives_404(monkeypatch):
    async def fake_alts(**kwargs):
        raise ServiceError(404, "Workout not found.")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.find_alternatives", fake_alts
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/alternatives?tr_workout_id=missing")
    assert r.status_code == 404
    assert r.json()["error"] is True


def test_library_alternatives_requires_tr_workout_id(monkeypatch):
    async def fake_alts(**kwargs):
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.find_alternatives", fake_alts
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/alternatives")
    # tr_workout_id is required (Query(...)) → 422
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/library/{tr_workout_id}
# ---------------------------------------------------------------------------

def test_library_workout_200(monkeypatch):
    async def fake_get(tr_workout_id):
        return SAMPLE_WORKOUT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.get_library_workout", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/w1")
    assert r.status_code == 200
    assert r.json()["name"] == "Kaweah"


def test_library_workout_404(monkeypatch):
    async def fake_get(tr_workout_id):
        raise ServiceError(404, "Not found.")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.get_library_workout", fake_get
    )
    c = _client(monkeypatch)
    r = c.get("/api/library/missing")
    assert r.status_code == 404
    assert r.json()["error"] is True


# ---------------------------------------------------------------------------
# POST /api/workouts/custom
# ---------------------------------------------------------------------------

def test_custom_workout_200_no_schedule(monkeypatch):
    async def fake_create(**kwargs):
        return {"workout_id": "wk-99", "scheduled": False, "event_id": None}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.create_custom_workout_svc", fake_create
    )
    c = _client(monkeypatch)
    payload = {
        "name": "VO2max 3x3",
        "workout_type": "Ride",
        "steps": [{"power": 120, "duration": 180}],
    }
    r = c.post("/api/workouts/custom", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["workout_id"] == "wk-99"
    assert data["scheduled"] is False
    assert data["event_id"] is None


def test_custom_workout_200_with_schedule(monkeypatch):
    async def fake_create(**kwargs):
        return {"workout_id": "wk-99", "scheduled": True, "event_id": "ev-42"}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.create_custom_workout_svc", fake_create
    )
    c = _client(monkeypatch)
    payload = {
        "name": "VO2max 3x3",
        "workout_type": "Ride",
        "steps": [{"power": 120, "duration": 180}],
        "schedule_date": "2026-07-01",
    }
    r = c.post("/api/workouts/custom", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["scheduled"] is True
    assert data["event_id"] == "ev-42"


def test_custom_workout_service_error(monkeypatch):
    async def fake_create(**kwargs):
        raise ServiceError(502, "upstream error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.create_custom_workout_svc", fake_create
    )
    c = _client(monkeypatch)
    payload = {
        "name": "Bad",
        "workout_type": "Ride",
        "steps": [],
    }
    r = c.post("/api/workouts/custom", json=payload)
    assert r.status_code == 502
    assert r.json()["error"] is True
    assert "upstream error" in r.json()["message"]


def test_custom_workout_missing_required_field(monkeypatch):
    async def fake_create(**kwargs):
        return {"workout_id": "x", "scheduled": False, "event_id": None}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.library.create_custom_workout_svc", fake_create
    )
    c = _client(monkeypatch)
    # Missing workout_type → 422
    r = c.post("/api/workouts/custom", json={"name": "X", "steps": []})
    assert r.status_code == 422
