import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

from intervals_mcp_server.services.errors import ServiceError


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- /api/analytics/pmc ---

def test_pmc_200(monkeypatch):
    async def fake(days=90, athlete_id=None):
        return [{"date": "2026-06-25", "ctl": 55.0, "atl": 48.0, "tsb": 7.0}]

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.pmc_series", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/pmc?days=30")
    assert r.status_code == 200
    assert r.json()[0]["tsb"] == 7.0


def test_pmc_service_error(monkeypatch):
    async def fake(days=90, athlete_id=None):
        raise ServiceError(502, "down")

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.pmc_series", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/pmc")
    assert r.status_code == 502
    assert r.json()["error"] is True


def test_pmc_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    assert c.get("/api/analytics/pmc").status_code == 401


# --- /api/analytics/power-profile ---

def test_power_profile_200(monkeypatch):
    async def fake(sport="Ride", days=90, athlete_id=None):
        return {"durations": [{"secs": 5, "watts": 900, "date": None}]}

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.power_profile", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/power-profile")
    assert r.status_code == 200
    assert r.json()["durations"][0]["watts"] == 900


# --- /api/analytics/zone-distribution ---

def test_zone_distribution_200_parses_period(monkeypatch):
    captured = {}

    async def fake(weeks=4, athlete_id=None):
        captured["weeks"] = weeks
        return {"zones": [{"zone": "Z1", "seconds": 600, "pct": 50.0}], "target": []}

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.zone_distribution", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/zone-distribution?period=8w")
    assert r.status_code == 200
    assert captured["weeks"] == 8
    assert r.json()["zones"][0]["zone"] == "Z1"


def test_zone_distribution_bad_period_defaults(monkeypatch):
    captured = {}

    async def fake(weeks=4, athlete_id=None):
        captured["weeks"] = weeks
        return {"zones": [], "target": []}

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.zone_distribution", fake)
    c = _client(monkeypatch)
    c.get("/api/analytics/zone-distribution?period=garbage")
    assert captured["weeks"] == 4


# --- /api/analytics/volume ---

def test_volume_200(monkeypatch):
    async def fake(days=180, athlete_id=None):
        return [{"date": "2026-06-20", "tss": 80, "duration_secs": 3600, "type": "Ride"}]

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.volume_scatter", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/volume?days=90")
    assert r.status_code == 200
    assert r.json()[0]["type"] == "Ride"


# --- /api/analytics/weekly-volume ---

def test_weekly_volume_200(monkeypatch):
    async def fake(weeks=12, athlete_id=None):
        return [{"week_start": "2026-06-22", "hours": 1.5, "tss": 120, "sessions": 2}]

    monkeypatch.setattr("intervals_mcp_server.web.routes.analytics.weekly_volume", fake)
    c = _client(monkeypatch)
    r = c.get("/api/analytics/weekly-volume?weeks=8")
    assert r.status_code == 200
    assert r.json()[0]["sessions"] == 2
