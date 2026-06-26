import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import intervals_mcp_server.web.app as web_app_module
from fastapi import FastAPI
from intervals_mcp_server.web.app import create_app


def _all_paths(app: FastAPI) -> set[str]:
    """Collect all registered route paths, including those in included routers."""
    paths: set[str] = set()
    for r in app.routes:
        if hasattr(r, "path"):
            paths.add(r.path)
        elif hasattr(r, "original_router"):
            for sr in r.original_router.routes:
                if hasattr(sr, "path"):
                    paths.add(sr.path)
    return paths


def test_app_module_level_is_fastapi():
    assert isinstance(web_app_module.app, FastAPI)


def test_expected_routes_registered():
    app = create_app()
    paths = _all_paths(app)

    # Static paths
    assert "/api/health" in paths
    assert "/api/dashboard" in paths
    assert "/api/mcp/tools" in paths
    assert "/api/coaching/state" in paths
    assert "/api/wellness" in paths
    assert "/api/library/search" in paths
    assert "/api/library/alternatives" in paths
    assert "/api/workouts/custom" in paths

    # Parametrized paths (FastAPI stores the template)
    assert "/api/activities/{activity_id}" in paths
    assert "/api/events/{event_id}" in paths
    assert "/api/library/{tr_workout_id}" in paths
    assert "/api/mcp/{tool_name}" in paths


def test_main_entrypoint_importable_no_side_effects():
    import intervals_mcp_server.web.__main__ as m

    assert callable(m.main)
