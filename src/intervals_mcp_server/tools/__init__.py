"""
MCP tools registry for Intervals.icu MCP Server.

This module registers all available MCP tools with the FastMCP server instance.
"""

from mcp.server.fastmcp import FastMCP  # pylint: disable=import-error

# Import all tools for re-export
# Note: Tools register themselves via @mcp.tool() decorators when imported
from intervals_mcp_server.tools.activities import (  # noqa: F401
    add_activity_message,
    get_activities,
    get_activity_details,
    get_activity_intervals,
    get_activity_messages,
    get_activity_streams,
)
from intervals_mcp_server.tools.activity_analytics import (  # noqa: F401
    get_activity_gap_histogram,
    get_activity_hr_curve,
    get_activity_hr_histogram,
    get_activity_hr_load_model,
    get_activity_interval_stats,
    get_activity_map,
    get_activity_pace_curve,
    get_activity_pace_histogram,
    get_activity_power_curve,
    get_activity_power_histogram,
    get_activity_power_spike_model,
    get_activity_power_vs_hr,
    get_activity_segments,
    get_activity_time_at_hr,
    get_activity_weather,
    get_athlete_hr_curves,
    get_athlete_mmp_model,
    get_athlete_pace_curves,
    get_athlete_power_curves,
    get_athlete_power_hr_curve,
    get_best_efforts,
)
from intervals_mcp_server.tools.activity_management import (  # noqa: F401
    create_manual_activity,
    delete_activity,
    get_activities_around,
    search_activities,
    search_activities_full,
    update_activity,
)
from intervals_mcp_server.tools.athlete import (  # noqa: F401
    get_athlete,
    get_athlete_profile,
    get_training_plan,
    update_athlete,
)
from intervals_mcp_server.tools.coaching_analytics import (  # noqa: F401
    get_efficiency_trend,
    get_planned_vs_actual,
    get_power_profile_assessment,
    get_readiness_assessment,
    get_training_load_summary,
    get_weekly_training_volume,
    get_zone_distribution,
)
from intervals_mcp_server.tools.chats import (  # noqa: F401
    get_chat,
    get_chat_messages,
    get_chats,
    send_chat_message,
)
from intervals_mcp_server.tools.custom_items import (  # noqa: F401
    create_custom_item,
    delete_custom_item,
    get_custom_item_by_id,
    get_custom_items,
    update_custom_item,
)
from intervals_mcp_server.tools.event_extras import (  # noqa: F401
    apply_training_plan,
    create_events_bulk,
    duplicate_events,
    get_event_tags,
    mark_event_done,
)
from intervals_mcp_server.tools.events import (  # noqa: F401
    add_or_update_event,
    delete_event,
    delete_events_by_date_range,
    get_event_by_id,
    get_events,
)
from intervals_mcp_server.tools.folders import (  # noqa: F401
    create_folder,
    delete_folder,
    get_folders,
    update_folder,
)
from intervals_mcp_server.tools.gear import (  # noqa: F401
    create_gear,
    delete_gear,
    get_gear,
    recalculate_gear_stats,
    update_gear,
)
from intervals_mcp_server.tools.routes import (  # noqa: F401
    compare_routes,
    get_route,
    get_routes,
    update_route,
)
from intervals_mcp_server.tools.sport_settings import (  # noqa: F401
    create_sport_setting,
    delete_sport_setting,
    get_sport_setting,
    get_sport_settings,
    update_sport_setting,
)
from intervals_mcp_server.tools.weather import (  # noqa: F401
    get_weather_config,
    get_weather_forecast,
    update_weather_config,
)
from intervals_mcp_server.tools.trainerroad import (  # noqa: F401
    get_trainerroad_workout_details,
    get_trainerroad_workouts,
    sync_trainerroad_calendar,
)
from intervals_mcp_server.tools.wellness import get_wellness_data  # noqa: F401
from intervals_mcp_server.tools.wellness_management import (  # noqa: F401
    bulk_update_wellness,
    get_wellness_by_date,
    update_wellness,
)
from intervals_mcp_server.tools.workouts import (  # noqa: F401
    create_workout,
    delete_workout,
    get_workout_by_id,
    get_workout_tags,
    get_workouts,
    update_workout,
)


def register_tools(mcp_instance: FastMCP) -> None:
    """
    Register all MCP tools with the FastMCP server instance.

    This function imports all tool modules, which causes their @mcp.tool()
    decorators to register the tools. The tools need access to the mcp instance,
    so they will be imported after the mcp instance is created.

    Args:
        mcp_instance (FastMCP): The FastMCP server instance to register tools with.
    """
    # Tools are registered via decorators when modules are imported above
    # The mcp_instance parameter is kept for future use if needed
    _ = mcp_instance


__all__ = [
    "register_tools",
    # Activities
    "get_activities",
    "get_activity_details",
    "get_activity_intervals",
    "get_activity_streams",
    "get_activity_messages",
    "add_activity_message",
    # Activity analytics
    "get_best_efforts",
    "get_activity_power_curve",
    "get_activity_pace_curve",
    "get_activity_hr_curve",
    "get_activity_power_histogram",
    "get_activity_pace_histogram",
    "get_activity_gap_histogram",
    "get_activity_hr_histogram",
    "get_activity_power_vs_hr",
    "get_activity_map",
    "get_activity_segments",
    "get_activity_weather",
    "get_activity_interval_stats",
    "get_activity_hr_load_model",
    "get_activity_time_at_hr",
    "get_activity_power_spike_model",
    "get_athlete_power_curves",
    "get_athlete_pace_curves",
    "get_athlete_hr_curves",
    "get_athlete_mmp_model",
    "get_athlete_power_hr_curve",
    # Activity management
    "update_activity",
    "delete_activity",
    "search_activities",
    "search_activities_full",
    "create_manual_activity",
    "get_activities_around",
    # Athlete
    "get_athlete",
    "update_athlete",
    "get_athlete_profile",
    "get_training_plan",
    # Events
    "get_events",
    "get_event_by_id",
    "delete_event",
    "delete_events_by_date_range",
    "add_or_update_event",
    # Event extras
    "create_events_bulk",
    "get_event_tags",
    "apply_training_plan",
    "duplicate_events",
    "mark_event_done",
    # Wellness
    "get_wellness_data",
    "get_wellness_by_date",
    "update_wellness",
    "bulk_update_wellness",
    # Custom items
    "get_custom_items",
    "get_custom_item_by_id",
    "create_custom_item",
    "update_custom_item",
    "delete_custom_item",
    # Workouts
    "get_workouts",
    "get_workout_by_id",
    "create_workout",
    "update_workout",
    "delete_workout",
    "get_workout_tags",
    # Folders
    "get_folders",
    "create_folder",
    "update_folder",
    "delete_folder",
    # Gear
    "get_gear",
    "create_gear",
    "update_gear",
    "delete_gear",
    "recalculate_gear_stats",
    # Routes
    "get_routes",
    "get_route",
    "update_route",
    "compare_routes",
    # Weather
    "get_weather_config",
    "update_weather_config",
    "get_weather_forecast",
    # Sport settings
    "get_sport_settings",
    "get_sport_setting",
    "create_sport_setting",
    "update_sport_setting",
    "delete_sport_setting",
    # Chats
    "get_chats",
    "get_chat",
    "get_chat_messages",
    "send_chat_message",
    # Coaching analytics
    "get_training_load_summary",
    "get_weekly_training_volume",
    "get_zone_distribution",
    "get_readiness_assessment",
    "get_planned_vs_actual",
    "get_efficiency_trend",
    "get_power_profile_assessment",
    # TrainerRoad sync
    "sync_trainerroad_calendar",
    "get_trainerroad_workouts",
    "get_trainerroad_workout_details",
]
