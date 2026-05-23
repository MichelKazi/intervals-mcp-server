"""
Intervals.icu MCP Server

Usage:
    $ python src/intervals_mcp_server/server.py

See the README for configuration details.
"""

import logging

from intervals_mcp_server.api.client import (
    httpx_client,
    make_intervals_request,
)
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp
from intervals_mcp_server.server_setup import setup_transport, start_server
from intervals_mcp_server.utils.validation import validate_athlete_id

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("intervals_icu_mcp_server")

config = get_config()

# Import resources (registers via @mcp.resource() decorator)
import intervals_mcp_server.resources  # noqa: E402, F401

# Import tool modules to register them (tools register themselves via @mcp.tool() decorators)
from intervals_mcp_server.tools.activities import (  # noqa: E402
    get_activities,
    get_activity_details,
    get_activity_intervals,
    get_activity_streams,
    manage_activity_messages,
)
from intervals_mcp_server.tools.activity_analytics import (  # noqa: E402
    get_activity_analytics,
    get_activity_curve,
    get_activity_histogram,
    get_athlete_curves,
    get_best_efforts,
)
from intervals_mcp_server.tools.activity_management import (  # noqa: E402
    create_manual_activity,
    delete_activity,
    search_activities,
    update_activity,
)
from intervals_mcp_server.tools.activity_review import (  # noqa: E402
    get_daily_summary,
    get_latest_activity,
    get_week_in_review,
    review_activity,
)
from intervals_mcp_server.tools.athlete import (  # noqa: E402
    get_athlete,
    get_athlete_profile,
    get_training_plan,
    update_athlete,
)
from intervals_mcp_server.tools.chats import manage_chats  # noqa: E402
from intervals_mcp_server.tools.coaching_analytics import (  # noqa: E402
    get_efficiency_trend,
    get_planned_vs_actual,
    get_power_profile_assessment,
    get_readiness_assessment,
    get_training_load_summary,
    get_weekly_training_volume,
    get_zone_distribution,
)
from intervals_mcp_server.tools.custom_items import manage_custom_items  # noqa: E402
from intervals_mcp_server.tools.events import (  # noqa: E402
    add_or_update_event,
    manage_events,
)
from intervals_mcp_server.tools.folders import manage_folders  # noqa: E402
from intervals_mcp_server.tools.gear import manage_gear  # noqa: E402
from intervals_mcp_server.tools.routes import manage_routes  # noqa: E402
from intervals_mcp_server.tools.sport_settings import manage_sport_settings  # noqa: E402
from intervals_mcp_server.tools.athlete_context import get_athlete_context  # noqa: E402
from intervals_mcp_server.tools.trainerroad import (  # noqa: E402
    get_trainerroad_workout_details,
    get_trainerroad_workouts,
    sync_trainerroad_calendar,
)
from intervals_mcp_server.tools.weather import manage_weather  # noqa: E402
from intervals_mcp_server.tools.wellness import (  # noqa: E402
    get_wellness,
    update_wellness,
)
from intervals_mcp_server.tools.aerobic_development import get_aerobic_development  # noqa: E402
from intervals_mcp_server.tools.fatigue_risk import get_fatigue_risk  # noqa: E402
from intervals_mcp_server.tools.power_progression import get_power_progression  # noqa: E402
from intervals_mcp_server.tools.recovery_patterns import get_recovery_patterns  # noqa: E402
from intervals_mcp_server.tools.training_insights import get_training_insights  # noqa: E402
from intervals_mcp_server.tools.workouts import manage_workouts  # noqa: E402

__all__ = [
    "make_intervals_request",
    "httpx_client",
    "get_activities",
    "get_activity_details",
    "get_activity_intervals",
    "get_activity_streams",
    "manage_activity_messages",
    "get_activity_curve",
    "get_activity_histogram",
    "get_activity_analytics",
    "get_best_efforts",
    "get_athlete_curves",
    "update_activity",
    "delete_activity",
    "search_activities",
    "create_manual_activity",
    "get_latest_activity",
    "review_activity",
    "get_daily_summary",
    "get_week_in_review",
    "get_athlete",
    "update_athlete",
    "get_athlete_profile",
    "get_training_plan",
    "manage_events",
    "add_or_update_event",
    "get_wellness",
    "update_wellness",
    "manage_custom_items",
    "manage_workouts",
    "manage_folders",
    "manage_gear",
    "manage_routes",
    "manage_weather",
    "manage_sport_settings",
    "manage_chats",
    "get_training_load_summary",
    "get_weekly_training_volume",
    "get_zone_distribution",
    "get_readiness_assessment",
    "get_planned_vs_actual",
    "get_efficiency_trend",
    "get_power_profile_assessment",
    "get_training_insights",
    "get_aerobic_development",
    "get_fatigue_risk",
    "get_power_progression",
    "get_recovery_patterns",
    "sync_trainerroad_calendar",
    "get_trainerroad_workouts",
    "get_trainerroad_workout_details",
    "get_athlete_context",
]


if __name__ == "__main__":
    validate_athlete_id(config.athlete_id)
    selected_transport = setup_transport()
    start_server(mcp, selected_transport)
