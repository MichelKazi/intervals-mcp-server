import importlib.metadata
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError


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

    from intervals_mcp_server.web.routes import library as library_routes
    app.include_router(library_routes.router)

    from intervals_mcp_server.web.routes import coaching as coaching_routes
    app.include_router(coaching_routes.router)

    from intervals_mcp_server.web.routes import mcp_bridge
    app.include_router(mcp_bridge.router)

    # Mount built frontend SPA when dist is present.
    # parents[3] = repo root  (app.py -> web -> intervals_mcp_server -> src -> repo root)
    _dist = Path(__file__).resolve().parents[3] / "web-ui" / "dist"
    if _dist.is_dir():
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
