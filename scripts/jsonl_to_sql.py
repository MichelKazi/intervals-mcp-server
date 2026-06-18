#!/usr/bin/env python
"""Convert crawl JSONL output to batched SQL INSERT statements.

Usage:
    python scripts/jsonl_to_sql.py /tmp/tr_workouts_full.jsonl > /tmp/tr_inserts.sql

Produces INSERT...ON CONFLICT statements in batches of 25 rows.
"""

import json
import sys


BATCH_SIZE = 25


def escape_sql(val: str) -> str:
    return val.replace("'", "''").replace("\\", "\\\\")


def format_row(r: dict) -> str:
    name = escape_sql(r["name"])
    desc = escape_sql((r.get("description") or "")[:500])
    sport = r.get("sport_type", "VirtualRide")
    zones = "{" + ",".join(r.get("zone_focus", [])) + "}"
    tags = "{" + ",".join(r.get("tags", [])) + "}"
    intervals = json.dumps(r.get("intervals_json", []))
    intervals_escaped = escape_sql(intervals)

    return (
        f"('{r['tr_workout_id']}', '{name}', '{desc}', "
        f"{r['duration_secs']}, {r['tss']}, {str(r['is_outside']).lower()}, "
        f"'{sport}', '{zones}', '{tags}', "
        f"{r['intensity_min']}, {r['intensity_max']}, {r['interval_count']}, "
        f"'{r.get('adaptation_target', '')}', '{r.get('interval_pattern', '')}', "
        f"{str(r.get('race_specific', False)).lower()}, "
        f"{r.get('work_duration_avg', 0)}, {r.get('recovery_duration_avg', 0)}, "
        f"'{intervals_escaped}'::jsonb)"
    )


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/jsonl_to_sql.py <input.jsonl>", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]
    rows = []

    with open(input_file) as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))

    print(f"-- {len(rows)} workouts total", file=sys.stderr)

    cols = (
        "tr_workout_id, name, description, duration_secs, tss, is_outside, "
        "sport_type, zone_focus, tags, intensity_min, intensity_max, interval_count, "
        "adaptation_target, interval_pattern, race_specific, "
        "work_duration_avg, recovery_duration_avg, intervals_json"
    )

    upsert_clause = """ON CONFLICT (tr_workout_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_secs = EXCLUDED.duration_secs,
  tss = EXCLUDED.tss,
  zone_focus = EXCLUDED.zone_focus,
  tags = EXCLUDED.tags,
  intensity_min = EXCLUDED.intensity_min,
  intensity_max = EXCLUDED.intensity_max,
  interval_count = EXCLUDED.interval_count,
  adaptation_target = EXCLUDED.adaptation_target,
  interval_pattern = EXCLUDED.interval_pattern,
  race_specific = EXCLUDED.race_specific,
  work_duration_avg = EXCLUDED.work_duration_avg,
  recovery_duration_avg = EXCLUDED.recovery_duration_avg,
  intervals_json = EXCLUDED.intervals_json,
  updated_at = NOW();"""

    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        values = []
        for r in batch:
            try:
                values.append(format_row(r))
            except Exception as e:
                print(f"-- Skipping {r.get('tr_workout_id', '?')}: {e}", file=sys.stderr)
                continue

        if values:
            print(f"INSERT INTO tr_workout_library ({cols})")
            print("VALUES")
            print(",\n".join(values))
            print(upsert_clause)
            print()


if __name__ == "__main__":
    main()
