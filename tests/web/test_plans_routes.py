import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

from fastapi.testclient import TestClient


SAMPLE_COMPUTED = {
    "gainRequired": 30,
    "achievability": "moderate",
}

SAMPLE_PLAN = {
    "athlete_id": "i1",
    "name": "Spring Threshold Build",
    "goal": SAMPLE_COMPUTED,
    "hard_weekdays": [1, 3, 5],
    "weeks": 10,
    "start_date": "2026-07-01",
    "skeleton": {"weeks": []},
}


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- POST /api/coaching/ftp-goal/plan-name ---

def test_plan_name_passthrough(monkeypatch):
    captured = {}

    async def fake_suggest(computed, hard_weekdays, weeks):
        captured["computed"] = computed
        captured["hard_weekdays"] = hard_weekdays
        captured["weeks"] = weeks
        return {"name": "Spring Threshold Build"}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.suggest_plan_name", fake_suggest
    )
    c = _client(monkeypatch)
    r = c.post(
        "/api/coaching/ftp-goal/plan-name",
        json={"computed": SAMPLE_COMPUTED, "hard_weekdays": [1, 3, 5], "weeks": 10},
    )
    assert r.status_code == 200
    assert r.json() == {"name": "Spring Threshold Build"}
    assert captured["computed"] == SAMPLE_COMPUTED
    assert captured["hard_weekdays"] == [1, 3, 5]
    assert captured["weeks"] == 10


def test_plan_name_fallback(monkeypatch):
    async def fake_suggest(computed, hard_weekdays, weeks):
        return None

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.suggest_plan_name", fake_suggest
    )
    c = _client(monkeypatch)
    r = c.post(
        "/api/coaching/ftp-goal/plan-name",
        json={"computed": SAMPLE_COMPUTED, "hard_weekdays": [1, 3], "weeks": 8},
    )
    assert r.status_code == 200
    assert r.json() == {"name": "30W Build"}


def test_plan_name_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/coaching/ftp-goal/plan-name", json={"computed": {}})
    assert r.status_code == 401


# --- POST /api/plans ---

def test_save_plan_passthrough(monkeypatch):
    captured = {}

    async def fake_save(plan):
        captured["plan"] = plan
        return {**plan, "id": "abc-123"}

    monkeypatch.setattr("intervals_mcp_server.directeur_client.save_plan", fake_save)
    c = _client(monkeypatch)
    r = c.post("/api/plans", json=SAMPLE_PLAN)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "abc-123"
    assert data["name"] == "Spring Threshold Build"
    assert captured["plan"] == SAMPLE_PLAN


def test_save_plan_fallback(monkeypatch):
    async def fake_save(plan):
        return None

    monkeypatch.setattr("intervals_mcp_server.directeur_client.save_plan", fake_save)
    c = _client(monkeypatch)
    r = c.post("/api/plans", json=SAMPLE_PLAN)
    assert r.status_code == 200
    data = r.json()
    assert data["persisted"] is False
    assert data["name"] == "Spring Threshold Build"


def test_save_plan_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/plans", json=SAMPLE_PLAN)
    assert r.status_code == 401


# --- GET /api/plans/active ---

def test_active_plan_passthrough(monkeypatch):
    captured = {}

    async def fake_active(athlete_id):
        captured["athlete_id"] = athlete_id
        return {"plan": {"id": "abc-123", "name": "Spring Threshold Build"}}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.get_active_plan", fake_active
    )
    c = _client(monkeypatch)
    r = c.get("/api/plans/active", params={"athlete_id": "i42"})
    assert r.status_code == 200
    assert r.json()["plan"]["id"] == "abc-123"
    assert captured["athlete_id"] == "i42"


def test_active_plan_defaults_to_config_athlete(monkeypatch):
    captured = {}

    async def fake_active(athlete_id):
        captured["athlete_id"] = athlete_id
        return {"plan": None}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.get_active_plan", fake_active
    )
    c = _client(monkeypatch)
    r = c.get("/api/plans/active")
    assert r.status_code == 200
    assert captured["athlete_id"] == "i1"


def test_active_plan_fallback(monkeypatch):
    async def fake_active(athlete_id):
        return None

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.get_active_plan", fake_active
    )
    c = _client(monkeypatch)
    r = c.get("/api/plans/active", params={"athlete_id": "i1"})
    assert r.status_code == 200
    assert r.json() == {"plan": None}


def test_active_plan_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.get("/api/plans/active", params={"athlete_id": "i1"})
    assert r.status_code == 401


# --- POST /api/plans/{plan_id}/archive ---

def test_archive_plan_passthrough(monkeypatch):
    captured = {}

    async def fake_archive(plan_id):
        captured["plan_id"] = plan_id
        return {"archived": True, "id": plan_id}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.archive_plan", fake_archive
    )
    c = _client(monkeypatch)
    r = c.post("/api/plans/abc-123/archive")
    assert r.status_code == 200
    assert r.json() == {"archived": True, "id": "abc-123"}
    assert captured["plan_id"] == "abc-123"


def test_archive_plan_fallback(monkeypatch):
    async def fake_archive(plan_id):
        return None

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.archive_plan", fake_archive
    )
    c = _client(monkeypatch)
    r = c.post("/api/plans/abc-123/archive")
    assert r.status_code == 200
    assert r.json() == {"archived": False}


def test_archive_plan_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/plans/abc-123/archive")
    assert r.status_code == 401
