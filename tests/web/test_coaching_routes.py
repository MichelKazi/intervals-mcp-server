import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_SNAPSHOT = {
    "readiness": {"verdict": "green", "score": 85},
    "patterns": [],
    "levels": {},
    "progression": {},
}

SAMPLE_WELLNESS = [
    {"date": "2026-06-25", "ctl": 55.2, "atl": 48.1, "tsb": 7.1},
]

SAMPLE_DASHBOARD = {
    "next_workout": {"id": "ev1", "category": "WORKOUT", "start_date_local": "2026-06-28T09:00:00"},
    "latest_activity": {"id": "act1", "name": "Morning Ride"},
    "readiness": {"verdict": "green", "score": 85},
}


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- GET /api/coaching/state ---

def test_coaching_state_200(monkeypatch):
    async def fake_coaching_state(zone="threshold"):
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.coaching_state", fake_coaching_state
    )
    c = _client(monkeypatch)
    r = c.get("/api/coaching/state")
    assert r.status_code == 200
    data = r.json()
    assert data["readiness"]["verdict"] == "green"


def test_coaching_state_with_zone_param(monkeypatch):
    captured = {}

    async def fake_coaching_state(zone="threshold"):
        captured["zone"] = zone
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.coaching_state", fake_coaching_state
    )
    c = _client(monkeypatch)
    c.get("/api/coaching/state?zone=vo2max")
    assert captured.get("zone") == "vo2max"


def test_coaching_state_service_error(monkeypatch):
    async def fake_coaching_state(zone="threshold"):
        raise ServiceError(503, "directeur down")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.coaching_state", fake_coaching_state
    )
    c = _client(monkeypatch)
    r = c.get("/api/coaching/state")
    assert r.status_code == 503
    assert r.json()["error"] is True
    assert "directeur down" in r.json()["message"]


def test_coaching_state_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/coaching/state")
    assert r.status_code == 401


# --- GET /api/wellness ---

def test_wellness_200(monkeypatch):
    async def fake_wellness_series(oldest=None, newest=None, athlete_id=None):
        return SAMPLE_WELLNESS

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.wellness_series", fake_wellness_series
    )
    c = _client(monkeypatch)
    r = c.get("/api/wellness")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert data[0]["date"] == "2026-06-25"


def test_wellness_with_date_params(monkeypatch):
    captured = {}

    async def fake_wellness_series(oldest=None, newest=None, athlete_id=None):
        captured["oldest"] = oldest
        captured["newest"] = newest
        return SAMPLE_WELLNESS

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.wellness_series", fake_wellness_series
    )
    c = _client(monkeypatch)
    c.get("/api/wellness?oldest=2026-06-01&newest=2026-06-26")
    assert captured["oldest"] == "2026-06-01"
    assert captured["newest"] == "2026-06-26"


def test_wellness_service_error(monkeypatch):
    async def fake_wellness_series(oldest=None, newest=None, athlete_id=None):
        raise ServiceError(502, "upstream error")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.wellness_series", fake_wellness_series
    )
    c = _client(monkeypatch)
    r = c.get("/api/wellness")
    assert r.status_code == 502
    assert r.json()["error"] is True


# --- GET /api/dashboard ---

def test_dashboard_200(monkeypatch):
    async def fake_dashboard(athlete_id=None):
        return SAMPLE_DASHBOARD

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.dashboard", fake_dashboard
    )
    c = _client(monkeypatch)
    r = c.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert "next_workout" in data
    assert "latest_activity" in data
    assert "readiness" in data


def test_dashboard_readiness_null_still_200(monkeypatch):
    async def fake_dashboard(athlete_id=None):
        return {"next_workout": None, "latest_activity": None, "readiness": None}

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.dashboard", fake_dashboard
    )
    c = _client(monkeypatch)
    r = c.get("/api/dashboard")
    assert r.status_code == 200
    data = r.json()
    assert data["readiness"] is None


def test_dashboard_service_error(monkeypatch):
    async def fake_dashboard(athlete_id=None):
        raise ServiceError(502, "something broke")

    monkeypatch.setattr(
        "intervals_mcp_server.web.routes.coaching.dashboard", fake_dashboard
    )
    c = _client(monkeypatch)
    r = c.get("/api/dashboard")
    assert r.status_code == 502
    assert r.json()["error"] is True
