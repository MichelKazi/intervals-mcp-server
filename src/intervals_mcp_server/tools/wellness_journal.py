"""Wellness journal sync MCP tool — syncs wellness data to Supabase for Brain MCP integration."""

from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.wellness_sync import backfill_wellness, sync_wellness_today


@mcp.tool()
async def sync_wellness_journal(
    backfill: bool = False,
) -> str:
    """Sync today's wellness to the shared Supabase wellness_journal table.

    Fetches current wellness from Intervals.icu, computes a recovery score
    (0-100 composite of TSB, HRV, RHR, sleep, subjective fatigue), and writes
    to the shared database for Brain MCP to read.

    Set backfill=True on first run to populate the last 90 days.

    Args:
        backfill: If True, backfill 90 days of history (only if < 7 rows exist). Defaults to False.
    """
    if backfill:
        result = await backfill_wellness(days=90)
        return result

    return await sync_wellness_today()
