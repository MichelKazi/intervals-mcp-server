#!/usr/bin/env python
"""Crawl TrainerRoad library and dump classified workouts to JSONL.

Outputs one JSON line per workout to stdout (redirect to file).
Then bulk-insert via Supabase MCP or psql.

Usage:
    python scripts/crawl_tr_to_jsonl.py > /tmp/tr_workouts.jsonl
    python scripts/crawl_tr_to_jsonl.py --limit 50 > /tmp/tr_workouts_sample.jsonl
"""

import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from intervals_mcp_server.config import get_config
from intervals_mcp_server.trainerroad.client import TRClient, TRAuthError
from intervals_mcp_server.trainerroad.classifier import classify_workout
from intervals_mcp_server.trainerroad.models import TRIntervalData

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", stream=sys.stderr)
logger = logging.getLogger(__name__)

SEARCH_TERMS = [
    "", "vo2max", "threshold", "sweet spot", "over-under", "endurance",
    "tempo", "sprint", "anaerobic", "ramp", "recovery", "tabata", "race",
    "time trial", "climbing", "cadence", "progressive", "burst",
    "neuromuscular", "aerobic", "muscular endurance", "short power",
    "sustained power", "attack", "billat", "cruise", "force",
    "microbursts", "repeatability",
]

PAGE_SIZE = 50
MAX_PAGES_PER_TERM = 20


def _interval_to_dict(iv: TRIntervalData) -> dict:
    return {
        "start": iv.start,
        "end": iv.end,
        "name": iv.name,
        "is_fake": iv.is_fake,
        "test_interval": iv.test_interval,
        "power_pct": iv.start_target_power_percent,
    }


async def crawl(limit: int | None = None):
    config = get_config()
    if not config.trainerroad_username or not config.trainerroad_password:
        logger.error("TRAINERROAD_USERNAME and TRAINERROAD_PASSWORD must be set")
        return

    client = TRClient(
        username=config.trainerroad_username,
        password=config.trainerroad_password,
    )

    try:
        member = await client.validate_and_get_member()
        logger.info("Authenticated as %s", member.username)
    except TRAuthError as e:
        logger.error("Auth failed: %s", e)
        return

    seen_ids: set[str] = set()
    total = 0

    for term in SEARCH_TERMS:
        if limit and total >= limit:
            break

        page = 0
        while page < MAX_PAGES_PER_TERM:
            if limit and total >= limit:
                break

            try:
                await client._ensure_cookie()
                import httpx
                payload = json.dumps({
                    "searchText": term,
                    "pageNumber": page,
                    "pageSize": PAGE_SIZE,
                })
                async with httpx.AsyncClient() as http:
                    resp = await http.post(
                        "https://www.trainerroad.com/app/api/workouts",
                        headers={**client._headers(), "Content-Type": "application/json"},
                        content=payload,
                        timeout=30.0,
                    )
                    resp.raise_for_status()
                    data = resp.json()

                workouts = data.get("Workouts", [])
                if not workouts:
                    break

                # Collect new workout IDs from this page
                new_wids = []
                for w in workouts:
                    wid = str(w.get("Id", ""))
                    if not wid or wid in seen_ids:
                        continue
                    seen_ids.add(wid)
                    new_wids.append(wid)

                # Fetch details concurrently (10 at a time)
                for batch_start in range(0, len(new_wids), 10):
                    batch_wids = new_wids[batch_start:batch_start + 10]
                    tasks = [client.get_workout_details(wid) for wid in batch_wids]
                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    for wid, result in zip(batch_wids, results):
                        if isinstance(result, Exception):
                            logger.warning("Failed %s: %s", wid, result)
                            continue

                        details = result
                        classification = classify_workout(details)
                        intervals_json = [_interval_to_dict(iv) for iv in details.intervals]

                        row = {
                            "tr_workout_id": details.workout_id,
                            "name": details.name,
                            "description": (details.description or "")[:2000],
                            "duration_secs": details.duration_secs,
                            "tss": details.tss,
                            "is_outside": details.is_outside,
                            "sport_type": details.sport_type,
                            "zone_focus": classification["zone_focus"],
                            "tags": classification["tags"],
                            "intensity_min": classification["intensity_min"],
                            "intensity_max": classification["intensity_max"],
                            "interval_count": classification["interval_count"],
                            "adaptation_target": classification["adaptation_target"],
                            "interval_pattern": classification["interval_pattern"],
                            "race_specific": classification["race_specific"],
                            "work_duration_avg": classification["work_duration_avg"],
                            "recovery_duration_avg": classification["recovery_duration_avg"],
                            "intervals_json": intervals_json,
                        }

                        print(json.dumps(row), flush=True)
                        total += 1

                    if limit and total >= limit:
                        break

                if limit and total >= limit:
                    break

                page += 1

            except Exception as e:
                logger.warning("Error term='%s' page=%d: %s", term, page, e)
                await asyncio.sleep(2)
                break

    logger.info("Done. %d workouts written. %d unique IDs seen.", total, len(seen_ids))


if __name__ == "__main__":
    limit_val = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            limit_val = int(sys.argv[idx + 1])

    asyncio.run(crawl(limit=limit_val))
