import importlib.metadata
import logging
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError

logger = logging.getLogger("intervals_icu_mcp_server")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="intervals-mcp web API")
    origin = get_config().web_allowed_origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def _log_requests(request: Request, call_next):
        # Log every API request with method, path, status, and duration so
        # broken endpoints are easy to spot in the deploy logs. Static/SPA
        # asset noise is skipped.
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            ms = (time.monotonic() - start) * 1000
            logger.exception("%s %s -> 500 (%.0fms)", request.method, request.url.path, ms)
            raise
        ms = (time.monotonic() - start) * 1000
        path = request.url.path
        if path.startswith("/api/") or response.status_code >= 400:
            log = logger.warning if response.status_code >= 400 else logger.info
            log("%s %s -> %s (%.0fms)", request.method, path, response.status_code, ms)
        return response

    @app.exception_handler(ServiceError)
    async def _svc_err(_req, exc: ServiceError):
        return JSONResponse(status_code=exc.status_code, content={"error": True, "message": exc.message})

    try:
        version = importlib.metadata.version("intervals-mcp-server")
    except Exception:
        version = "0.0.0"

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "version": version}

    from intervals_mcp_server.web.routes import activities as activities_routes
    app.include_router(activities_routes.router)

    from intervals_mcp_server.web.routes import calendar as calendar_routes
    app.include_router(calendar_routes.router)
    app.include_router(calendar_routes.time_off_router)

    from intervals_mcp_server.web.routes import library as library_routes
    app.include_router(library_routes.router)

    from intervals_mcp_server.web.routes import coaching as coaching_routes
    app.include_router(coaching_routes.router)

    from intervals_mcp_server.web.routes import ftp_goal as ftp_goal_routes
    app.include_router(ftp_goal_routes.router)

    from intervals_mcp_server.web.routes import plans as plans_routes
    app.include_router(plans_routes.router)

    from intervals_mcp_server.web.routes import analytics as analytics_routes
    app.include_router(analytics_routes.router)

    from intervals_mcp_server.web.routes import command as command_routes
    app.include_router(command_routes.router)

    from intervals_mcp_server.web.routes import mcp_bridge
    app.include_router(mcp_bridge.router)

    # Mount built frontend SPA when dist is present.
    # The package may be pip-installed (site-packages), so __file__-relative paths
    # don't reach the repo. Check, in order: WEB_UI_DIST env override, the working
    # directory (Docker copies dist to /app/web-ui/dist with WORKDIR /app), then the
    # source-tree-relative path (editable installs / local dev).
    _candidates = [
        Path(os.environ["WEB_UI_DIST"]) if os.environ.get("WEB_UI_DIST") else None,
        Path.cwd() / "web-ui" / "dist",
        Path(__file__).resolve().parents[3] / "web-ui" / "dist",
    ]
    _dist = next((p for p in _candidates if p and p.is_dir()), None)
    if _dist is not None:
        app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

        # Use a 404 handler for SPA fallback so it never shadows /api/* routes.
        # Any path that reaches a genuine 404 (no API route matched) is served
        # as index.html unless it starts with "api/", in which case the 404 is real.
        @app.exception_handler(404)
        async def _spa_fallback(request: Request, _exc: HTTPException):
            path = request.url.path.lstrip("/")
            if path.startswith("api/"):
                return JSONResponse(status_code=404, content={"detail": "Not Found"})
            candidate = _dist / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(_dist / "index.html")

    return app


app = create_app()
