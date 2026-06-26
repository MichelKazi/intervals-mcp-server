"""
JSON routes for analytics charts: PMC, power profile, zone distribution, volume.

Each route is a thin delegation to the analytics service, returning chartable
structured data (not formatted strings). Auth is enforced via require_token.
"""

from fastapi import APIRouter, Depends, Query

from intervals_mcp_server.services.analytics import (
    pmc_series,
    power_profile,
    volume_scatter,
    weekly_volume,
    zone_distribution,
)
from intervals_mcp_server.web.auth import require_token

router = APIRouter(prefix="/api/analytics", dependencies=[Depends(require_token)])


@router.get("/pmc")
async def analytics_pmc(
    days: int = Query(default=90),
    athlete_id: str | None = Query(default=None),
):
    """PMC series: array of {date, ctl, atl, tsb, rampRate?}."""
    return await pmc_series(days=days, athlete_id=athlete_id)


@router.get("/power-profile")
async def analytics_power_profile(
    sport: str = Query(default="Ride"),
    days: int = Query(default=90),
    athlete_id: str | None = Query(default=None),
):
    """Power profile: {durations: [{secs, watts, date}]}."""
    return await power_profile(sport=sport, days=days, athlete_id=athlete_id)


@router.get("/zone-distribution")
async def analytics_zone_distribution(
    period: str = Query(default="4w"),
    athlete_id: str | None = Query(default=None),
):
    """Zone distribution: {zones: [{zone, seconds, pct}], target: []}."""
    weeks = _parse_weeks(period, default=4)
    return await zone_distribution(weeks=weeks, athlete_id=athlete_id)


@router.get("/volume")
async def analytics_volume(
    days: int = Query(default=180),
    athlete_id: str | None = Query(default=None),
):
    """Volume scatter: array of {date, tss, duration_secs, type}."""
    return await volume_scatter(days=days, athlete_id=athlete_id)


@router.get("/weekly-volume")
async def analytics_weekly_volume(
    weeks: int = Query(default=12),
    athlete_id: str | None = Query(default=None),
):
    """Weekly volume: array of {week_start, hours, tss, sessions}."""
    return await weekly_volume(weeks=weeks, athlete_id=athlete_id)


def _parse_weeks(period: str, default: int) -> int:
    """Parse a '4w' / '8w' style period into a week count, falling back to default."""
    p = period.strip().lower()
    if p.endswith("w"):
        p = p[:-1]
    try:
        return max(1, int(p))
    except ValueError:
        return default
