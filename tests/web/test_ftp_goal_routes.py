import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

from fastapi.testclient import TestClient


SAMPLE_COMPUTED = {
    "input": {"currentFtp": 250, "targetFtp": 280, "targetDate": "2026-09-01", "currentCtl": 60},
    "gainRequired": 30,
    "gainPct": 12.0,
    "weeksAvailable": 10,
    "isPhysicallyPossible": True,
    "achievability": "moderate",
    "baseConfidence": 70,
    "validationMessage": "Reachable with consistent build blocks.",
}


def _client(monkeypatch, token=""):
    monkeypatch.setenv("WEB_API_TOKEN", token)
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app())


# --- POST /api/coaching/ftp-goal ---

def test_ftp_goal_directeur_unavailable_fallback(monkeypatch):
    async def fake_validate(computed):
        return None

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.validate_ftp_goal", fake_validate
    )
    c = _client(monkeypatch)
    r = c.post("/api/coaching/ftp-goal", json=SAMPLE_COMPUTED)
    assert r.status_code == 200
    data = r.json()
    assert data["computed"] == SAMPLE_COMPUTED
    assert data["coaching_note"] == "Reachable with consistent build blocks."
    assert data["risk_factors"] == []
    assert data["confidence_pct"] == 70


def test_ftp_goal_clamps_confidence_down(monkeypatch):
    async def fake_validate(computed):
        return {
            "coaching_note": "LLM note.",
            "risk_factors": ["aggressive ramp"],
            "confidence_pct": 99,
        }

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.validate_ftp_goal", fake_validate
    )
    c = _client(monkeypatch)
    r = c.post("/api/coaching/ftp-goal", json=SAMPLE_COMPUTED)
    assert r.status_code == 200
    data = r.json()
    # LLM tried 99 but baseConfidence is 70 -> clamped to 70.
    assert data["confidence_pct"] == 70
    assert data["coaching_note"] == "LLM note."
    assert data["risk_factors"] == ["aggressive ramp"]


def test_ftp_goal_clamps_confidence_floor(monkeypatch):
    async def fake_validate(computed):
        return {"coaching_note": "", "risk_factors": [], "confidence_pct": 0}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.validate_ftp_goal", fake_validate
    )
    c = _client(monkeypatch)
    r = c.post("/api/coaching/ftp-goal", json=SAMPLE_COMPUTED)
    assert r.json()["confidence_pct"] == 5


def test_ftp_goal_llm_may_lower_confidence(monkeypatch):
    async def fake_validate(computed):
        return {"coaching_note": "n", "risk_factors": [], "confidence_pct": 40}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.validate_ftp_goal", fake_validate
    )
    c = _client(monkeypatch)
    r = c.post("/api/coaching/ftp-goal", json=SAMPLE_COMPUTED)
    assert r.json()["confidence_pct"] == 40


def test_ftp_goal_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    c = TestClient(create_app())
    r = c.post("/api/coaching/ftp-goal", json=SAMPLE_COMPUTED)
    assert r.status_code == 401


# --- POST /api/coaching/ftp-plan ---

def test_ftp_plan_directeur_unavailable(monkeypatch):
    async def fake_plan(assessment, availability):
        return None

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.generate_ftp_plan", fake_plan
    )
    c = _client(monkeypatch)
    r = c.post("/api/coaching/ftp-plan", json={"assessment": {}, "availability": {}})
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] is None
    assert "message" in data


def test_ftp_plan_returns_plan(monkeypatch):
    captured = {}

    async def fake_plan(assessment, availability):
        captured["assessment"] = assessment
        captured["availability"] = availability
        return {"plan": {"weeks": 8}}

    monkeypatch.setattr(
        "intervals_mcp_server.directeur_client.generate_ftp_plan", fake_plan
    )
    c = _client(monkeypatch)
    r = c.post(
        "/api/coaching/ftp-plan",
        json={"assessment": {"confidence_pct": 70}, "availability": {"daysPerWeek": 4}},
    )
    assert r.status_code == 200
    assert r.json() == {"plan": {"weeks": 8}}
    assert captured["assessment"] == {"confidence_pct": 70}
    assert captured["availability"] == {"daysPerWeek": 4}
