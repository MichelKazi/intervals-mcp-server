"""Athlete context tool — low-token summary of profile + plan for session start."""

from datetime import datetime

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.resource_store import athlete_profile, training_plan
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


async def _warm_profile(athlete_id: str, api_key: str | None) -> None:
    """Fetch athlete + today's wellness to populate the profile cache if cold."""
    if athlete_profile.ftp is not None and athlete_profile.ctl is not None:
        return

    athlete_data = await make_intervals_request(
        url=f"/athlete/{athlete_id}", api_key=api_key
    )
    if isinstance(athlete_data, dict) and "error" not in athlete_data:
        athlete_profile.update_from_athlete(athlete_data)

    today = datetime.now().strftime("%Y-%m-%d")
    wellness_data = await make_intervals_request(
        url=f"/athlete/{athlete_id}/wellness",
        api_key=api_key,
        params={"oldest": today, "newest": today},
    )
    if isinstance(wellness_data, list) and wellness_data:
        athlete_profile.update_from_wellness(wellness_data[-1])


async def _warm_plan(athlete_id: str, api_key: str | None) -> None:
    """Fetch TR plan info and today's events to populate the plan cache if cold."""
    if training_plan.phase is not None:
        return

    from intervals_mcp_server.tools.trainerroad import _get_tr_client

    client = _get_tr_client()
    if client:
        try:
            await client.validate_and_get_member()
            plan_info = await client.get_training_plan()
            training_plan.update_from_tr_plan(plan_info)

            today = datetime.now().strftime("%Y-%m-%d")
            from datetime import timedelta
            end = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
            activities = await client.get_calendar_activities(today, end)

            races = [a for a in activities if a.is_race]
            if races:
                training_plan.update_races(races)

            workouts = [a for a in activities if not a.is_completed and not a.is_rest_day and a.workout_name]
            if workouts:
                training_plan.update_this_week(workouts, today)

            athlete_profile.update_phase(training_plan.phase, training_plan.phase_week)
        except Exception:
            pass


@mcp.tool()
async def get_athlete_context(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Low-token athlete context for session start. Returns profile (FTP, weight, fitness) + plan (phase, races, this week).

    Call this FIRST in any coaching conversation. Returns cached data if available (zero API calls),
    or fetches fresh data if the cache is cold. Other tools (get_daily_summary, get_training_insights,
    get_trainerroad_workouts) update this cache as a side-effect, so it stays fresh.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    await _warm_profile(athlete_id_to_use, api_key)
    await _warm_plan(athlete_id_to_use, api_key)

    now = datetime.now()
    lines = [
        f"Context (today is {now.strftime('%A %Y-%m-%d %H:%M %Z').strip()})",
        "",
        athlete_profile.format(),
        "",
        training_plan.format(),
    ]
    return "\n".join(lines)
