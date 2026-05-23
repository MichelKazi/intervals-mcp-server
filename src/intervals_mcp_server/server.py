"""
Intervals.icu MCP Server

This module implements a Model Context Protocol (MCP) server for connecting
Claude with the Intervals.icu API. It provides tools for retrieving and managing
athlete data, including activities, events, workouts, and wellness metrics.

Usage:
    This server is designed to be run as a standalone script and exposes several MCP tools
    for use with Claude Desktop or other MCP-compatible clients. The server loads configuration
    from environment variables (optionally via a .env file) and communicates with the Intervals.icu API.

    To run the server:
        $ python src/intervals_mcp_server/server.py

    See the README for more details on configuration and usage.
"""

import logging

# Import API client and configuration
from intervals_mcp_server.api.client import (
    httpx_client,  # Re-export for backward compatibility with tests
    make_intervals_request,
)
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp

# Import types and validation
from intervals_mcp_server.server_setup import setup_transport, start_server
from intervals_mcp_server.utils.validation import validate_athlete_id

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("intervals_icu_mcp_server")

# Get configuration instance
config = get_config()

# Import tool modules to register them (tools register themselves via @mcp.tool() decorators)
from intervals_mcp_server.tools.activities import (  # pylint: disable=wrong-import-position  # noqa: E402
    add_activity_message,
    get_activities,
    get_activity_details,
    get_activity_intervals,
    get_activity_messages,
    get_activity_streams,
    set_coach_tick,
)
from intervals_mcp_server.tools.activity_analytics import (  # pylint: disable=wrong-import-position  # noqa: E402
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
from intervals_mcp_server.tools.activity_management import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_manual_activity,
    delete_activity,
    get_activities_around,
    search_activities,
    search_activities_full,
    update_activity,
)
from intervals_mcp_server.tools.athlete import (  # pylint: disable=wrong-import-position  # noqa: E402
    get_athlete,
    get_athlete_profile,
    get_training_plan,
    update_athlete,
)
from intervals_mcp_server.tools.coaching_analytics import (  # pylint: disable=wrong-import-position  # noqa: E402
    get_efficiency_trend,
    get_planned_vs_actual,
    get_power_profile_assessment,
    get_readiness_assessment,
    get_training_load_summary,
    get_weekly_training_volume,
    get_zone_distribution,
)
from intervals_mcp_server.tools.chats import (  # pylint: disable=wrong-import-position  # noqa: E402
    get_chat,
    get_chat_messages,
    get_chats,
    send_chat_message,
)
from intervals_mcp_server.tools.custom_items import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_custom_item,
    delete_custom_item,
    get_custom_item_by_id,
    get_custom_items,
    update_custom_item,
)
from intervals_mcp_server.tools.event_extras import (  # pylint: disable=wrong-import-position  # noqa: E402
    apply_training_plan,
    create_events_bulk,
    duplicate_events,
    get_event_tags,
    mark_event_done,
)
from intervals_mcp_server.tools.events import (  # pylint: disable=wrong-import-position  # noqa: E402
    add_or_update_event,
    delete_event,
    delete_events_by_date_range,
    get_event_by_id,
    get_events,
)
from intervals_mcp_server.tools.folders import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_folder,
    delete_folder,
    get_folders,
    update_folder,
)
from intervals_mcp_server.tools.gear import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_gear,
    delete_gear,
    get_gear,
    recalculate_gear_stats,
    update_gear,
)
from intervals_mcp_server.tools.routes import (  # pylint: disable=wrong-import-position  # noqa: E402
    compare_routes,
    get_route,
    get_routes,
    update_route,
)
from intervals_mcp_server.tools.sport_settings import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_sport_setting,
    delete_sport_setting,
    get_sport_setting,
    get_sport_settings,
    update_sport_setting,
)
from intervals_mcp_server.tools.weather import (  # pylint: disable=wrong-import-position  # noqa: E402
    get_weather_config,
    get_weather_forecast,
    update_weather_config,
)
from intervals_mcp_server.tools.trainerroad import (  # pylint: disable=wrong-import-position  # noqa: E402
    get_trainerroad_workout_details,
    get_trainerroad_workouts,
    sync_trainerroad_calendar,
)
from intervals_mcp_server.tools.wellness import get_wellness_data  # pylint: disable=wrong-import-position  # noqa: E402
from intervals_mcp_server.tools.wellness_management import (  # pylint: disable=wrong-import-position  # noqa: E402
    bulk_update_wellness,
    get_wellness_by_date,
    update_wellness,
)
from intervals_mcp_server.tools.workouts import (  # pylint: disable=wrong-import-position  # noqa: E402
    create_workout,
    delete_workout,
    get_workout_by_id,
    get_workout_tags,
    get_workouts,
    update_workout,
)

# Re-export make_intervals_request and httpx_client for backward compatibility
__all__ = [
    "make_intervals_request",
    "httpx_client",
    # Activities
    "add_activity_message",
    "get_activities",
    "get_activity_details",
    "get_activity_intervals",
    "get_activity_messages",
    "get_activity_streams",
    "set_coach_tick",
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


# Run the server
if __name__ == "__main__":
    # Validate ATHLETE_ID when server starts (not at import time to allow tests)
    validate_athlete_id(config.athlete_id)

    # Setup transport and start server
    selected_transport = setup_transport()
    start_server(mcp, selected_transport)
