### Task 1: Web app scaffold, config, auth, health

**Files:**
- Modify: `pyproject.toml` (add fastapi, uvicorn deps)
- Modify: `src/intervals_mcp_server/config.py` (add `web_api_token`, `web_allowed_origin`)
- Create: `src/intervals_mcp_server/services/__init__.py`
- Create: `src/intervals_mcp_server/services/errors.py` (`ServiceError`)
- Create: `src/intervals_mcp_server/web/__init__.py`
- Create: `src/intervals_mcp_server/web/auth.py`
- Create: `src/intervals_mcp_server/web/app.py`
- Test: `tests/web/__init__.py`, `tests/web/test_app.py`

**Interfaces:**
- Produces:
  - `services.errors.ServiceError(status_code: int, message: str)` — exception, attrs `.status_code`, `.message`.
  - `web.auth.require_token` — FastAPI dependency (callable) that raises `HTTPException(401)` unless `Authorization: Bearer <WEB_API_TOKEN>` matches. If `WEB_API_TOKEN` env is unset/empty, auth is disabled (local dev) — document this.
  - `web.app.create_app() -> FastAPI` and module-level `app = create_app()`.
  - `web.app` registers a global exception handler mapping `ServiceError` → `JSONResponse(status_code=e.status_code, content={"error": True, "message": e.message})`.
  - `GET /api/health` (no auth) → `{"status": "ok", "version": <pyproject version>}`.

- [ ] **Step 1: Write failing tests** in `tests/web/test_app.py`:

```python
import os
import pathlib
import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

from fastapi.testclient import TestClient
from intervals_mcp_server.web.app import create_app
from intervals_mcp_server.services.errors import ServiceError

def _client(token=None, monkeypatch=None):
    if monkeypatch is not None:
        monkeypatch.setenv("WEB_API_TOKEN", token or "")
    # config is a singleton; reset so env change takes effect
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    return TestClient(create_app())

def test_health_no_auth(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    c = TestClient(create_app())
    r = c.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

def test_protected_route_requires_token(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "secret")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    app = create_app()
    # add a probe route guarded by require_token
    from intervals_mcp_server.web.auth import require_token
    from fastapi import Depends
    @app.get("/api/_probe")
    def _probe(_=Depends(require_token)):
        return {"ok": True}
    c = TestClient(app)
    assert c.get("/api/_probe").status_code == 401
    assert c.get("/api/_probe", headers={"Authorization": "Bearer secret"}).status_code == 200

def test_service_error_handler(monkeypatch):
    monkeypatch.setenv("WEB_API_TOKEN", "")
    import intervals_mcp_server.config as cfg
    cfg._config_instance = None
    app = create_app()
    @app.get("/api/_boom")
    def _boom():
        raise ServiceError(404, "not found")
    c = TestClient(app)
    r = c.get("/api/_boom")
    assert r.status_code == 404
    assert r.json() == {"error": True, "message": "not found"}
```

- [ ] **Step 2: Run, verify fail** — `uv run python -m pytest tests/web/test_app.py -q` → import errors.

- [ ] **Step 3: Add deps** to `pyproject.toml` dependencies list: `"fastapi>=0.110"`, `"uvicorn[standard]>=0.27"`. Run `uv sync` (or `uv lock`).

- [ ] **Step 4: Implement.**

`services/errors.py`:
```python
class ServiceError(Exception):
    """Raised by service functions on upstream failure; routes map to JSON + status."""
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
```

Add to `config.py` `Config` dataclass: `web_api_token: str` and `web_allowed_origin: str`; in `load_config()` read `os.getenv("WEB_API_TOKEN", "")` and `os.getenv("WEB_ALLOWED_ORIGIN", "*")` and pass them.

`web/auth.py`:
```python
from fastapi import Header, HTTPException
from intervals_mcp_server.config import get_config

def require_token(authorization: str | None = Header(default=None)) -> None:
    token = get_config().web_api_token
    if not token:
        return  # auth disabled (local dev)
    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
```

`web/app.py`:
```python
import importlib.metadata
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError

def create_app() -> FastAPI:
    app = FastAPI(title="intervals-mcp web API")
    origin = get_config().web_allowed_origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[origin] if origin != "*" else ["*"],
        allow_methods=["*"], allow_headers=["*"],
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

    # routers registered in later tasks via register_routes(app)
    return app

app = create_app()
```

- [ ] **Step 5: Run tests pass** — `uv run python -m pytest tests/web/test_app.py -q` then full suite `uv run python -m pytest -q`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "Add FastAPI web app scaffold with auth, health, ServiceError handler"`

---

