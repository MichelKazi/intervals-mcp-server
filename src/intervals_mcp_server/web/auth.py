"""
Bearer token authentication dependency for the web API.

If WEB_API_TOKEN is unset or empty, auth is disabled (local dev convenience).
Set it to a strong random string in production.
"""

from fastapi import Header, HTTPException

from intervals_mcp_server.config import get_config


def require_token(authorization: str | None = Header(default=None)) -> None:
    """FastAPI dependency that enforces bearer token auth when WEB_API_TOKEN is set."""
    token = get_config().web_api_token
    if not token:
        return  # auth disabled (local dev)
    expected = f"Bearer {token}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
