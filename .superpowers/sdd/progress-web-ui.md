# Web UI PWA Shell — progress ledger

Plan: inline in user prompt (2026-06-26)
Branch: feat/web-ui
Merge base: 2c7ae25e95b9cbf8e0f3afe03013a5eead3930ec

## Tasks

- Task 1 (PWA shell build): complete (commits 2c7ae25..e900b36, review clean)

## Minor/Nit items (non-blocking, for screen implementers)
- WorkoutChart.test.tsx comment off-by-one in brief (code correct, bar[1] is first vo2max after warmup)
- BottomNav: Home tab activates on /activities path too — intentional for stub, revisit when Activities screen is real
- format.ts shortDay: always returns weekday name, no "Jun 26" date-fallback form — spec doc was aspirational, no test coverage
