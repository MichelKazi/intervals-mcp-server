# Brain MCP ↔ Intervals MCP Integration

## Credentials (add to Railway env vars)

```env
SUPABASE_URL=https://witrgovuotihhxyprnca.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpdHJnb3Z1b3RpaGh4eXBybmNhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1MDI5NiwiZXhwIjoyMDk0NDI2Mjk2fQ.mLa8KiKjCyLlb2b8TGUGgqL0RcXOIh-vo6ZBDJcx524
ATHLETE_ID=i131804
```

`ATHLETE_ID` is already in your config — use the same value (`i131804`) when writing to `wellness_journal` and `risk_flags`.

## Shared Tables (already created, in production)

### 1. `wellness_journal` — Intervals MCP WRITES here, Brain reads.

```
Columns: id (uuid PK), athlete_id (text), date (date), ctl, atl, tsb, hrv, resting_hr, sleep_secs, weight (all real/int), fatigue/mood/soreness/stress (int 1-5), recovery_score (real, computed at write time), custom_fields (jsonb), created_at, updated_at
Unique constraint: (athlete_id, date)
```

### 2. `risk_flags` — Intervals MCP WRITES here, Brain reads.

```
Columns: id (uuid PK), athlete_id (text), flag_type (text), severity ('warning'|'critical'), detected_at (timestamptz), detected_date (generated date), resolved_at (timestamptz nullable), context (jsonb), source_tool (text)
Unique index: (athlete_id, flag_type, detected_date)
```

### 3. `coaching_principles_staging` — Brain MCP WRITES here, Intervals reads.

```
Columns: id (text PK, snake_case), context (text[]), principle (text), evidence (text), threshold (text nullable), recommendation (text nullable), promoted_at (timestamptz), promoted_by (text), confidence ('experimental'|'validated'|'established'), source_nodes (text[]), active (boolean), supersedes (text nullable), created_at, updated_at
```

## What to Implement

### 1. Add dependency

Add `supabase` Python client to project dependencies. Add the three env vars above to Railway.

### 2. Startup: `sync_coaching_principles()`

On server start, read `SELECT * FROM coaching_principles_staging WHERE active = TRUE`. Merge into the in-memory `PRINCIPLES` list. If a staging row has `supersedes` matching a hardcoded principle's `id`, the staging version wins. If Supabase is unreachable, log a warning and continue with hardcoded principles only (graceful degradation).

### 3. Coaching principles reload

On each tool invocation that calls `get_principles_for_context()`, check if the staging table has been updated since last read (compare `max(updated_at)` against a cached timestamp). If newer, re-read and re-merge. The table is ~20 rows — negligible overhead.

### 4. Nightly wellness sync

Cron job (`0 6 * * * UTC`): fetch today's wellness from Intervals.icu (`GET /athlete/{id}/wellness/{date}`), compute `recovery_score` using the formula below, UPSERT into `wellness_journal`. Also run a one-time backfill of the last 90 days on first execution (check if table has < 7 rows).

### 5. Recovery score formula

```python
def compute_recovery_score(tsb, hrv, hrv_baseline_28d, resting_hr, rhr_baseline_28d, sleep_secs, fatigue_subjective):
    components, weights = [], []
    if tsb is not None:
        components.append(max(0, min(100, (tsb + 30) * 2))); weights.append(0.30)
    if hrv and hrv_baseline_28d and hrv_baseline_28d > 0:
        z = (hrv - hrv_baseline_28d) / (hrv_baseline_28d * 0.15)
        components.append(max(0, min(100, 50 + z * 25))); weights.append(0.25)
    if resting_hr and rhr_baseline_28d and rhr_baseline_28d > 0:
        z = (resting_hr - rhr_baseline_28d) / (rhr_baseline_28d * 0.08)
        components.append(max(0, min(100, 50 - z * 25))); weights.append(0.15)
    if sleep_secs is not None:
        components.append(max(0, min(100, (sleep_secs/3600 - 4) * 20))); weights.append(0.20)
    if fatigue_subjective is not None:
        components.append((fatigue_subjective - 1) * 25); weights.append(0.10)
    if len(components) < 2: return None
    return round(sum(c*w for c,w in zip(components, weights)) / sum(weights), 1)
```

### 6. Risk flag writes

In `get_fatigue_risk`, wellness analysis, and aerobic development tools: when a risk condition is detected, UPSERT into `risk_flags`. When condition clears, set `resolved_at = NOW()`.

| flag_type | critical if | warning if | source_tool |
|-----------|------------|------------|-------------|
| ACWR_SPIKE | ACWR > 1.5 | ACWR > 1.3 | get_fatigue_risk |
| HRV_SUPPRESSION | z < -2.5 | z < -1.5 | wellness analysis |
| SLEEP_DEBT | N/A | < baseline for 3+ days | wellness analysis |
| HIGH_MONOTONY | N/A | monotony > 2.0 | get_fatigue_risk |
| RAMP_RATE | increase > 30% | increase > 20% | get_fatigue_risk |
| RHR_ELEVATED | z > 2.5 | z > 1.5 | wellness analysis |
| DRIFT_REGRESSION | N/A | drift worsening >15% over 4w | get_aerobic_development |
| LOAD_COLLAPSE | N/A | load drops >50% from 4w avg | get_fatigue_risk |

### 7. Context JSONB

Include the numbers that triggered detection. Examples:

```json
ACWR_SPIKE: {"acwr": 1.47, "acute_load": 580, "chronic_load": 395, "days_in_zone": 3}
HRV_SUPPRESSION: {"hrv": 32, "baseline_28d": 48, "z_score": -2.1}
SLEEP_DEBT: {"avg_sleep_h": 5.8, "baseline_h": 7.2, "consecutive_days": 4}
HIGH_MONOTONY: {"monotony": 2.3, "week_start": "2025-05-19", "daily_loads": [80,85,82,79,84,81,83]}
RAMP_RATE: {"current_week_load": 650, "prev_week_load": 480, "increase_pct": 35.4}
RHR_ELEVATED: {"rhr": 58, "baseline_28d": 49, "z_score": 1.8}
DRIFT_REGRESSION: {"recent_avg_drift": 7.2, "prior_avg_drift": 5.1, "regression_pct": 41}
LOAD_COLLAPSE: {"current_week_load": 180, "avg_4w_load": 420, "drop_pct": 57}
```

### 8. NULL handling

If a metric needed for detection is NULL, do NOT raise the flag. Never write 0 as a stand-in for missing data.

## Design Decisions (already resolved)

- **No pg_notify** — polling replaces it. Brain checks tables at session start; Intervals re-reads staging on tool calls with TTL cache.
- **IDs are snake_case** — matches existing `coaching_principles.py` convention.
- **Env var is `SUPABASE_SERVICE_ROLE_KEY`** (not `SUPABASE_KEY`).
- **Backwards compatible** — if `SUPABASE_URL` is not set, the server works exactly as today. All DB integration is additive and wrapped in try/except.
- **Backfill** — on first wellness sync (table has < 7 rows), fetch last 90 days from Intervals.icu and bulk insert. Baselines (28d HRV/RHR) are computed from `wellness_journal` rows for recovery_score and risk flag z-scores.

## Valid Context Tags

The Intervals MCP filters staging principles by these tags. Brain MCP validates against this list before writing.

```
fatigue_risk, aerobic_development, zone_distribution, readiness,
planning, nutrition, race_prep, recovery, build_phase, threshold,
intervals, vo2max, periodization, weight, athlete_specific,
intensity, base_building, volume, load_management, overtraining,
injury, tapering, peaking, missed_training, illness, returning,
drift, progress, durability, criterium, strength, force,
wellness, sleep, anti_pattern, recreational
```

## What NOT to Do

- Do NOT call Brain MCP tools or Supabase tables that Brain owns (notes, memories, brain_status, sync_log, sessions)
- Do NOT delete rows from `coaching_principles_staging` — only read
- Do NOT modify `wellness_journal` or `risk_flags` schema without coordinating
- Do NOT crash if Supabase is unreachable — graceful degradation is mandatory
