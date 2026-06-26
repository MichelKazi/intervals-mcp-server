import importlib.metadata

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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

    return app


app = create_app()
