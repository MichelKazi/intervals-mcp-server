"""MCP resources for Intervals.icu server — static context for LLM clients."""

from intervals_mcp_server.mcp_instance import mcp

USAGE_GUIDE = """\
# Intervals.icu MCP Server — Usage Guide

## Decision Tree: Which Tool To Call First

```
User asks about...
├── "How's my training going?" / "Give me an update"
│   └── get_training_insights(period="6w")  ← START HERE for any general coaching question
│
├── "Am I ready to train today?" / "Should I go hard?"
│   └── get_daily_summary()  ← morning briefing: wellness + yesterday + today's plan
│
├── "Review my week" / "How was last week?"
│   └── get_week_in_review(weeks_ago=0)  ← activities, compliance, zones, load
│
├── "Am I overtraining?" / "Injury risk?" / "Too much too fast?"
│   └── get_fatigue_risk()  ← ACWR analysis with risk bands
│
├── "How's my aerobic base?" / "cardiac drift" / "HR drift" / "endurance progress"
│   └── get_aerobic_development(weeks=12)  ← drift patterns by duration
│
├── "What predicts my good days?" / "sleep vs performance" / "recovery patterns"
│   └── get_recovery_patterns(days=60)  ← correlates wellness → performance
│
├── "Where's my power at?" / "Am I in form?" / "Race ready?"
│   └── get_power_progression(sport="Ride")  ← 28d vs 90d curve comparison
│
├── "What did I do yesterday?" / "Last ride/run?"
│   └── get_latest_activity(activity_type="Ride")  ← details + intervals in one call
│
├── "Review this specific activity" / coaching feedback
│   └── review_activity(activity_id, rating="good", comment="...")
│
├── Planning / scheduling workouts
│   └── add_or_update_event(...)  ← create/modify planned workouts
│
└── Everything else (CRUD, config, raw data)
    └── See "Data Tools" section below
```

## Principles

1. **Start with composite tools.** `get_training_insights`, `get_daily_summary`, and `get_week_in_review` each make 2-5 API calls internally and return pre-analyzed summaries. One call to these replaces 3-5 raw data tool calls.

2. **Never call raw data tools to "understand the athlete."** The analytics tools already compute CTL/ATL/TSB, zone distribution, efficiency trends, and load progression. Don't fetch wellness + activities separately and do mental math.

3. **Use analytics tools for analysis, CRUD tools for actions.** Analytics tools (get_*) return insights. Management tools (manage_*, update_*, add_*) modify state.

4. **The `period` parameter is your zoom control.** `get_training_insights(period="4w")` for recent focus, `period="12w"` for macro view.

## Tool Categories

### Tier 1: Start Here (composite analytics)
| Tool | When to use |
|------|-------------|
| `get_training_insights` | General "how's training" — load, efficiency, wellness z-scores, standouts |
| `get_daily_summary` | Morning check-in — today's wellness, yesterday's work, today's plan |
| `get_week_in_review` | End-of-week review — activities, zones, compliance, CTL delta |
| `get_readiness_assessment` | "Should I train hard today?" — combines TSB, HRV, sleep, subjective |

### Tier 2: Deep Dives (specialized analytics)
| Tool | When to use |
|------|-------------|
| `get_fatigue_risk` | Overtraining concern — ACWR with spike detection |
| `get_aerobic_development` | Base building progress — drift by duration, trend, concerning rides |
| `get_recovery_patterns` | What predicts your good days — wellness→performance correlations |
| `get_power_progression` | Form assessment — power curve vs baseline, rider profile |
| `get_efficiency_trend` | Aerobic efficiency — power:HR ratio weekly |
| `get_zone_distribution` | Polarization check — time in zones |
| `get_planned_vs_actual` | Compliance — did they do what was planned? |
| `get_power_profile_assessment` | Strengths/weaknesses — peak powers at key durations |

### Tier 3: Activity-Level
| Tool | When to use |
|------|-------------|
| `get_latest_activity` | "Last ride" — details + intervals in one call |
| `review_activity` | Coach review — details + streams + rating + comment |
| `get_activities` | List recent activities (only if you need to browse) |
| `get_activity_details` | Full details for a specific activity |
| `get_activity_intervals` | Interval breakdown for a specific activity |
| `get_activity_streams` | Raw time-series (power, HR, cadence, altitude) |

### Tier 4: Data Management (CRUD)
| Tool | When to use |
|------|-------------|
| `manage_events` | Calendar events: list, get, delete, bulk operations |
| `add_or_update_event` | Create/modify planned workouts (complex workout_doc support) |
| `manage_workouts` | Workout library: list, get, create, update, delete |
| `get_wellness` / `update_wellness` | Read/write wellness data |
| `update_activity` / `delete_activity` | Modify/remove activities |
| `manage_gear` | Equipment tracking |
| `manage_folders` | Organize workout library |
| `manage_custom_items` | User-defined tracking fields |
| `manage_sport_settings` | Sport-specific configuration |
| `manage_routes` | Route management |
| `manage_weather` | Weather config/forecasts |
| `manage_chats` | Chat/messaging |

### Tier 5: Specialized
| Tool | When to use |
|------|-------------|
| `get_activity_curve` | Power/pace/HR curves for a single activity |
| `get_activity_histogram` | Distribution plots for a single activity |
| `get_activity_analytics` | Detailed analytics for a single activity |
| `get_best_efforts` | Best effort segments for a single activity |
| `get_athlete_curves` | All-time/seasonal power curves |
| `get_athlete` / `update_athlete` | Athlete settings |
| `get_athlete_profile` | Zones, FTP, thresholds |
| `get_training_plan` | Current plan structure |
| `sync_trainerroad_calendar` | TrainerRoad integration |

## Anti-Patterns

- **Don't call `get_activities` + `get_wellness` + do math.** Use `get_training_insights` instead.
- **Don't call `get_activity_details` for the last ride.** Use `get_latest_activity` — it includes intervals.
- **Don't call multiple analytics tools for a general question.** `get_training_insights` covers load + efficiency + wellness + standouts in one shot.
- **Don't fetch raw streams to assess form.** Use `get_power_progression` or `get_training_insights`.
- **Don't call `get_wellness` to check readiness.** Use `get_readiness_assessment` or `get_daily_summary`.

## Workout Planning

When creating workouts, use `add_or_update_event` with `workout_doc` for structured intervals:
```json
{"steps": [
  {"power": {"value": 65, "units": "%ftp"}, "duration": 600, "warmup": true},
  {"reps": 4, "steps": [
    {"power": {"value": 105, "units": "%ftp"}, "duration": 300},
    {"power": {"value": 55, "units": "%ftp"}, "duration": 300}
  ]},
  {"power": {"value": 60, "units": "%ftp"}, "duration": 600, "cooldown": true}
]}
```

## Missing Data Handling

All analytics tools degrade gracefully:
- Insufficient data → descriptive message explaining what's needed
- Partial data → computes what it can, skips what it can't
- No wellness logging → analytics that need wellness say so explicitly
- No power data → efficiency/power tools explain the gap

The tools never crash or return empty results without explanation.
"""


@mcp.resource("intervals://usage-guide")
def get_usage_guide() -> str:
    """Intervals.icu MCP server usage guide — decision tree, tool categories, anti-patterns."""
    return USAGE_GUIDE
