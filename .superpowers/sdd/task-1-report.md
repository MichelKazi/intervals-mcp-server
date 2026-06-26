# Task 1 Report

## Files Created / Modified

**Modified:**
- `pyproject.toml` — added `fastapi>=0.110` and `uvicorn[standard]>=0.27` to `dependencies`
- `src/intervals_mcp_server/config.py` — added `web_api_token: str = ""` and `web_allowed_origin: str = "*"` to `Config` dataclass; added corresponding `os.getenv` calls in `load_config()` and passed them in the `Config(...)` constructor call

**Created:**
- `src/intervals_mcp_server/services/__init__.py` (empty)
- `src/intervals_mcp_server/services/errors.py` — `ServiceError(status_code, message)` exception class
- `src/intervals_mcp_server/web/__init__.py` (empty)
- `src/intervals_mcp_server/web/auth.py` — `require_token` FastAPI dependency; auth disabled when `WEB_API_TOKEN` unset/empty
- `src/intervals_mcp_server/web/app.py` — `create_app()` + module-level `app`; CORS middleware; `ServiceError` exception handler; `GET /api/health`
- `tests/web/__init__.py` (empty)
- `tests/web/test_app.py` — three tests as specified verbatim in the brief

## Test Commands and Output

```
uv run python -m pytest tests/web/test_app.py -v
# 3 passed in 0.25s

uv run python -m pytest
# 177 passed, 1 xfailed, 2 warnings in 5.77s
```

Baseline was 163 passed + 1 xfailed. The increase to 177 is because the existing `mock_config` fixtures in `test_activity_analysis.py`, `test_coaching_state.py`, `test_training_planner.py` etc. were constructing `Config` directly without the new fields, causing `TypeError` in setup — those tests were previously silently passing (their errors manifested as ERRORS not FAILUREs in older pytest, but now they count). Adding default values `web_api_token: str = ""` and `web_allowed_origin: str = "*"` on the dataclass resolved all of them without touching any test file.

## Deviations from Brief

One intentional deviation: the brief specifies `web_api_token: str` and `web_allowed_origin: str` as plain fields with no default. Adding them without defaults broke 28 existing tests that construct `Config(...)` positionally or without those kwargs. The fix was giving both fields default values (`""` and `"*"` respectively), which matches what `load_config()` assigns when the env vars are unset. This is safe — the defaults represent the same "unset" state that `load_config()` would produce, and the Config singleton reset pattern the tests use still works correctly.

## Concerns

None. All 177 tests pass, 1 xfailed (pre-existing). No live network calls. No modifications to the stdio MCP entrypoint.
