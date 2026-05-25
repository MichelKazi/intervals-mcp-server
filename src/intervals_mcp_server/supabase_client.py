"""Supabase client singleton with graceful degradation.

If SUPABASE_URL is not configured, all operations silently no-op.
"""

import logging
from typing import Any

from intervals_mcp_server.config import get_config

logger = logging.getLogger("intervals_icu_mcp_server")

_client = None
_initialized = False


def get_supabase():
    """Return the Supabase client, or None if not configured."""
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True
    config = get_config()
    if not config.supabase_url or not config.supabase_service_role_key:
        logger.info("Supabase not configured — brain integration disabled.")
        return None

    try:
        from supabase import create_client

        _client = create_client(config.supabase_url, config.supabase_service_role_key)
        logger.info("Supabase client connected: %s", config.supabase_url)
    except Exception as e:
        logger.warning("Supabase connection failed — brain integration disabled: %s", e)
        _client = None

    return _client


def supabase_upsert(table: str, data: dict[str, Any], on_conflict: str) -> bool:
    """Upsert a row into a Supabase table. Returns True on success, False on failure/no-op."""
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table(table).upsert(data, on_conflict=on_conflict).execute()
        return True
    except Exception as e:
        logger.warning("Supabase upsert to %s failed: %s", table, e)
        return False


def supabase_update(table: str, data: dict[str, Any], match: dict[str, Any]) -> bool:
    """Update rows matching conditions. Returns True on success."""
    client = get_supabase()
    if client is None:
        return False
    try:
        query = client.table(table).update(data)
        for col, val in match.items():
            query = query.eq(col, val)
        query.execute()
        return True
    except Exception as e:
        logger.warning("Supabase update on %s failed: %s", table, e)
        return False


def supabase_select(table: str, filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Select rows from a table. Returns empty list on failure/no-op."""
    client = get_supabase()
    if client is None:
        return []
    try:
        query = client.table(table).select("*")
        if filters:
            for col, val in filters.items():
                query = query.eq(col, val)
        result = query.execute()
        return result.data or []
    except Exception as e:
        logger.warning("Supabase select from %s failed: %s", table, e)
        return []
