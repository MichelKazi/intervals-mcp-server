## Global Constraints

- Python `>=3.12`. Match existing style (ruff, line-length 100).
- intervals.icu API key NEVER sent to browser — stays server-side.
- Existing MCP tool tests must remain green and unchanged — proves refactor preserved formatter behavior. Run `uv run python -m pytest -q` after every task.
- All new deps added to `pyproject.toml` `dependencies`: `fastapi>=0.110`, `uvicorn[standard]>=0.27`. (pydantic comes with fastapi.)
- New code lives under `src/intervals_mcp_server/services/` and `src/intervals_mcp_server/web/`. Do not modify the stdio MCP entrypoint (`server.py` `__main__`).
- Auth: single static bearer token from env `WEB_API_TOKEN`. Reject with 401. `/api/health` is exempt.
- Service functions raise `ServiceError(status_code: int, message: str)` on upstream failure. Routes translate to JSON `{"error": true, "message": ...}` with that status.
- Every service fn and route gets a test. Tests monkeypatch `make_intervals_request` / supabase / directeur — no live network.
- Commit after each task with a plain message (no Conventional Commits prefix needed for this personal repo, but keep it short and declarative).

---
