"""
MCP tools registry for Intervals.icu MCP Server.

This module registers all available MCP tools with the FastMCP server instance.
"""

from mcp.server.fastmcp import FastMCP  # pylint: disable=import-error

# Import all tools for re-export
# Note: Tools register themselves via @mcp.tool() decorators when imported
from intervals_mcp_server.tools.activities import (  # noqa: F401
    get_activities,
    get_activity_details,
    get_activity_intervals,
    get_activity_streams,
    manage_activity_messages,
)
from intervals_mcp_server.tools.activity_analytics import (  # noqa: F401
    get_activity_analytics,
    get_activity_curve,
    get_activity_histogram,
    get_athlete_curves,
    get_best_efforts,
)
from intervals_mcp_server.tools.activity_management import (  # noqa: F401
    create_manual_activity,
    delete_activity,
    search_activities,
    update_activity,
)
from intervals_mcp_server.tools.activity_review import (  # noqa: F401
    get_daily_summary,
    get_latest_activity,
    get_week_in_review,
    review_activity,
)
from intervals_mcp_server.tools.athlete import (  # noqa: F401
    get_athlete,
    get_athlete_profile,
    get_training_plan,
    update_athlete,
)
from intervals_mcp_server.tools.chats import manage_chats  # noqa: F401
from intervals_mcp_server.tools.coaching_analytics import (  # noqa: F401
    get_efficiency_trend,
    get_planned_vs_actual,
    get_power_profile_assessment,
    get_readiness_assessment,
    get_training_load_summary,
    get_weekly_training_volume,
    get_zone_distribution,
)
from intervals_mcp_server.tools.custom_items import manage_custom_items  # noqa: F401
from intervals_mcp_server.tools.events import (  # noqa: F401
    add_or_update_event,
    manage_events,
)
from intervals_mcp_server.tools.folders import manage_folders  # noqa: F401
from intervals_mcp_server.tools.gear import manage_gear  # noqa: F401
from intervals_mcp_server.tools.routes import manage_routes  # noqa: F401
from intervals_mcp_server.tools.sport_settings import manage_sport_settings  # noqa: F401
from intervals_mcp_server.tools.trainerroad import (  # noqa: F401
    get_trainerroad_workout_details,
    get_trainerroad_workouts,
    sync_trainerroad_calendar,
)
from intervals_mcp_server.tools.weather import manage_weather  # noqa: F401
from intervals_mcp_server.tools.wellness import (  # noqa: F401
    get_wellness,
    update_wellness,
)
from intervals_mcp_server.tools.training_insights import get_training_insights  # noqa: F401
from intervals_mcp_server.tools.workouts import manage_workouts  # noqa: F401


def register_tools(mcp_instance: FastMCP) -> None:
    """Register all MCP tools (they self-register via decorators on import)."""
    _ = mcp_instance


__all__ = [
    "register_tools",
    # Activities
    "get_activities",
    "get_activity_details",
    "get_activity_intervals",
    "get_activity_streams",
    "manage_activity_messages",
    # Activity analytics
    "get_activity_curve",
    "get_activity_histogram",
    "get_activity_analytics",
    "get_best_efforts",
    "get_athlete_curves",
    # Activity management
    "update_activity",
    "delete_activity",
    "search_activities",
    "create_manual_activity",
    # Activity review
    "get_latest_activity",
    "review_activity",
    "get_daily_summary",
    "get_week_in_review",
    # Athlete
    "get_athlete",
    "update_athlete",
    "get_athlete_profile",
    "get_training_plan",
    # Events
    "manage_events",
    "add_or_update_event",
    # Wellness
    "get_wellness",
    "update_wellness",
    # Custom items
    "manage_custom_items",
    # Workouts
    "manage_workouts",
    # Folders
    "manage_folders",
    # Gear
    "manage_gear",
    # Routes
    "manage_routes",
    # Weather
    "manage_weather",
    # Sport settings
    "manage_sport_settings",
    # Chats
    "manage_chats",
    # Coaching analytics
    "get_training_load_summary",
    "get_weekly_training_volume",
    "get_zone_distribution",
    "get_readiness_assessment",
    "get_planned_vs_actual",
    "get_efficiency_trend",
    "get_power_profile_assessment",
    # Training insights (polars)
    "get_training_insights",
    # TrainerRoad sync
    "sync_trainerroad_calendar",
    "get_trainerroad_workouts",
    "get_trainerroad_workout_details",
]
