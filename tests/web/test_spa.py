"""Tests for SPA static mount in the FastAPI app.

The SPA is mounted conditionally — only when web-ui/dist exists.
Tests that require the dist directory are skipped gracefully when it's absent.
GET /api/health always works regardless of dist presence.
"""
import os
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from fastapi.testclient import TestClient

_dist = pathlib.Path(__file__).resolve().parents[2] / "web-ui" / "dist"
_spa_available = _dist.is_dir()


def _client():
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    from intervals_mcp_server.web.app import create_app
    return TestClient(create_app(), raise_server_exceptions=False)


def test_api_health_always_works():
    """GET /api/health returns JSON regardless of whether dist exists."""
    c = _client()
    r = c.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"


@pytest.mark.skipif(not _spa_available, reason="web-ui/dist not built")
def test_spa_root_returns_html():
    """GET / returns 200 with HTML when dist is present."""
    c = _client()
    r = c.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")


@pytest.mark.skipif(not _spa_available, reason="web-ui/dist not built")
def test_spa_client_route_returns_index_html():
    """GET /some/client/route falls back to index.html for the SPA router."""
    c = _client()
    r = c.get("/some/client/route")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")


@pytest.mark.skipif(not _spa_available, reason="web-ui/dist not built")
def test_api_routes_not_shadowed_by_spa():
    """GET /api/health still returns JSON when SPA mount is active."""
    c = _client()
    r = c.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
