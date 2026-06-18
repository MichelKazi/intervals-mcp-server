#!/usr/bin/env python
"""One-time crawl of the TrainerRoad workout library.

Searches by category keywords, paginates through results, fetches full details
for each workout, classifies by zone/tags, and upserts to Supabase.

Usage:
    python scripts/crawl_tr_library.py [--dry-run] [--limit N]
"""

import asyncio
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from intervals_mcp_server.config import get_config
from intervals_mcp_server.trainerroad.client import TRClient, TRAuthError
from intervals_mcp_server.trainerroad.library import upsert_workout, workout_exists

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Search terms that cover the TR library broadly
SEARCH_TERMS = [
    "",  # empty string returns popular/all
    "vo2max",
    "threshold",
    "sweet spot",
    "over-under",
    "endurance",
    "tempo",
    "sprint",
    "anaerobic",
    "ramp",
    "recovery",
    "tabata",
    "race",
    "time trial",
    "climbing",
    "cadence",
    "progressive",
    "burst",
    "neuromuscular",
    "aerobic",
    "muscular endurance",
    "short power",
    "sustained power",
    "attack",
    "billat",
    "cruise",
    "force",
    "microbursts",
    "repeatability",
]

PAGE_SIZE = 50
MAX_PAGES_PER_TERM = 20  # 50 * 20 = 1000 per term max


async def crawl(dry_run: bool = False, limit: int | None = None):
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
    total_upserted = 0
    total_skipped = 0
    total_failed = 0

    for term in SEARCH_TERMS:
        if limit and total_upserted >= limit:
            break

        page = 0
        term_count = 0

        while page < MAX_PAGES_PER_TERM:
            if limit and total_upserted >= limit:
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

                for w in workouts:
                    wid = str(w.get("Id", ""))
                    if not wid or wid in seen_ids:
                        continue
                    seen_ids.add(wid)

                    if not dry_run and workout_exists(wid):
                        total_skipped += 1
                        continue

                    # Fetch full details
                    try:
                        details = await client.get_workout_details(wid)
                    except Exception as e:
                        logger.warning("Failed to get details for %s: %s", wid, e)
                        total_failed += 1
                        continue

                    if dry_run:
                        logger.info(
                            "[DRY RUN] Would upsert: %s (%s, %ds, TSS:%.0f)",
                            details.name, details.sport_type,
                            details.duration_secs, details.tss,
                        )
                        total_upserted += 1
                    else:
                        if upsert_workout(details):
                            total_upserted += 1
                            term_count += 1
                        else:
                            total_failed += 1

                    # Rate limit: be polite to TR's servers
                    await asyncio.sleep(0.3)

                    if limit and total_upserted >= limit:
                        break

                page += 1
                # Small delay between pages
                await asyncio.sleep(0.5)

            except Exception as e:
                logger.warning("Error on term='%s' page=%d: %s", term, page, e)
                await asyncio.sleep(2)
                break

        if term_count > 0:
            logger.info("Term '%s': %d new workouts", term, term_count)

    logger.info(
        "Done. Upserted: %d | Skipped (already cached): %d | Failed: %d | Total unique seen: %d",
        total_upserted, total_skipped, total_failed, len(seen_ids),
    )


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    limit_val = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            limit_val = int(sys.argv[idx + 1])

    asyncio.run(crawl(dry_run=dry_run, limit=limit_val))
