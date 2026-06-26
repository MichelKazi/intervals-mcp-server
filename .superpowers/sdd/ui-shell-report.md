# UI Shell Handoff — web-ui/

Branch: `feat/web-ui` | Commit: `59018b2`

The shared scaffold is live. Import from these modules to build screens.

---

## Entry Points

| Module | What's in it |
|--------|-------------|
| `src/lib/types.ts` | All TypeScript interfaces: WorkoutStep, WorkoutDoc, PlannedEvent, Activity, Readiness, Dashboard, WellnessDay, IntervalLap, Stream, ActivityIntervals, LibraryWorkout |
| `src/lib/api.ts` | Typed fetch client for every API route |
| `src/lib/format.ts` | formatDuration, formatWatts, formatDate, shortDay, kmFromMeters, zoneColor, zoneName |
| `src/components/AppShell.tsx` | Layout wrapper — all routes must use this |
| `src/components/WorkoutChart.tsx` | Workout visualization component |
| `src/components/BottomNav.tsx` | Fixed bottom nav — rendered by AppShell, do not render separately |

---

## AppShell Usage

Every route must wrap its content in AppShell:

```tsx
import AppShell from '../components/AppShell';

export default function MyScreen() {
  return (
    <AppShell title="Screen Title" showBack>
      {/* your content */}
    </AppShell>
  );
}
```

Props:
- `title: string` — shown in fixed top bar
- `showBack?: boolean` — shows back chevron (use on detail screens)
- `children: ReactNode`

---

## WorkoutChart Usage

```tsx
import WorkoutChart from '../components/WorkoutChart';

// Planned workout (steps mode)
<WorkoutChart steps={event.workout_doc?.steps} ftp={athlete.ftp} />

// Completed activity (laps mode)
<WorkoutChart laps={activityIntervals.icu_intervals} ftp={athlete.ftp} />
```

Props:
- `steps?: WorkoutStep[]` — from PlannedEvent.workout_doc.steps
- `laps?: IntervalLap[]` — from ActivityIntervals.icu_intervals
- `ftp?: number` — athlete FTP (watts). Used to derive %FTP for laps mode and to show watt values in readout.

Behavior:
- Repeat blocks are recursively flattened: `{reps: 3, steps: [...]}` expands to 3x the inner steps
- Each bar has `data-testid="workout-bar"` and is keyboard-navigable (arrow keys)
- Clicking a bar shows a readout panel below with zone, intensity, duration, %FTP
- Bar height encodes intensity (accessibility requirement — not color alone)

---

## API Client

All functions return typed Promises. Base URL: `VITE_API_BASE` env var (defaults to Railway production). Optional `VITE_API_TOKEN` for Bearer auth.

```typescript
// All exported functions
getDashboard(): Promise<Dashboard>
getActivities(params?: Record<string, string|number>): Promise<Activity[]>
getActivity(id: string|number): Promise<Activity>
getActivityIntervals(id: string|number): Promise<ActivityIntervals>
getActivityStreams(id: string|number, types?: string[]): Promise<Stream[]>
getEvents(oldest: string, newest: string): Promise<PlannedEvent[]>
getEvent(id: string|number): Promise<PlannedEvent>
createEvent(body: unknown): Promise<PlannedEvent>
updateEvent(id: string|number, body: unknown): Promise<PlannedEvent>
deleteEvent(id: string|number): Promise<void>
moveEvent(id: string|number, start_date: string): Promise<PlannedEvent>
markEventDone(id: string|number): Promise<PlannedEvent>
searchLibrary(params?: Record<string, string|number|boolean>): Promise<LibraryWorkout[]>
getLibraryWorkout(id: string): Promise<LibraryWorkout>
getAlternatives(params?: Record<string, string|number>): Promise<LibraryWorkout[]>
createCustomWorkout(body: unknown): Promise<unknown>
getWellness(oldest: string, newest: string): Promise<WellnessDay[]>
getCoachingState(zone?: string): Promise<unknown>
callMcp(tool: string, args?: Record<string, unknown>): Promise<unknown>
// Note: callMcp routes to POST /api/mcp/{tool} with args as the bare request body
getMcpTools(): Promise<unknown[]>
// GET /api/mcp/tools — returns the list of available MCP tool descriptors
```

Errors: all non-2xx responses throw `Error` with message from `{message}` field or HTTP status text.

---

## TanStack Query Pattern

The app is wrapped in `QueryClientProvider`. Use `useQuery` for reads, `useMutation` for writes:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../lib/api';

const { data, isLoading, error } = useQuery({
  queryKey: ['dashboard'],
  queryFn: getDashboard,
});
```

---

## Design Tokens

All screens use CSS vars from `src/theme/tokens.css`. Key vars:

```css
--bg          /* page background #0a0e14 */
--surface     /* card/header background #131a24 */
--surface-2   /* nested surface #1c2531 */
--text        /* primary text #e6edf3 */
--text-dim    /* secondary text #8b98a5 */
--border      /* dividers #243040 */
--accent      /* amber CTA #f0a500 */
--z1..--z7    /* zone colors: blue/green/yellow/orange/red/purple/magenta */
--sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px
/* NOTE: --sp-5 and --sp-7 are NOT defined in tokens.css */
--radius-sm, --radius, --radius-lg  /* 4/8/16 px */
--shadow-1, --shadow-2, --shadow-3  /* three elevation levels */
--font        /* system font stack */
--font-mono   /* monospace stack */
```

---

## Zone Boundaries

| %FTP | Zone | Token |
|------|------|-------|
| < 56 | recovery | --z1 |
| 56-75 | endurance | --z2 |
| 76-87 | tempo | --z3 |
| 88-94 | sweet spot | --z4 |
| 95-105 | threshold | --z5 |
| 106-120 | vo2max | --z6 |
| > 120 | anaerobic | --z7 |

---

## Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | Dashboard | Stub — implement |
| `/activities` | Dashboard | Same component |
| `/calendar` | Calendar | Stub — implement |
| `/library` | LibraryAdd | Stub — implement |
| `/workout/:id` | WorkoutDetail | Stub, has showBack |

---

## Running Tests

```bash
cd web-ui && npm test -- --run
```

17 tests in 3 files, all passing.

---

## Constraints for Screen Implementers

- 44px minimum touch targets on all interactive elements
- No Inter/Roboto — system font only (enforced by --font token)
- Dark theme only — use CSS var tokens, never hardcoded colors
- No meaning by color alone — use text labels + icons alongside color

---

## Fix wave

Applied after code-review pass. 21 tests pass, build clean.

| # | File | Fix |
|---|------|-----|
| 1 | `src/lib/api.ts` | 204/empty-body guard in `apiFetch`: returns `undefined as T` before calling `res.json()` when status is 204 or content-length is 0. Prevents "Unexpected end of JSON input" on `deleteEvent`. |
| 2 | `src/components/BottomNav.tsx` | Home tab `isActive` now uses `pathname === '/'` only. Removed `/activities` special-case that caused both Home and Activities to show active simultaneously. |
| 3 | `src/components/WorkoutChart.tsx` | Added `Enter`/`Space` handling in `handleKey`. Both keys call `setSelectedIdx(idx)` (with `preventDefault`). |
| 4 | `src/components/WorkoutChart.tsx` | Roving tabindex: each bar now gets `tabIndex={idx === (selectedIdx ?? 0) ? 0 : -1}`. Only one bar is a tab stop at a time. |
| 5 | `src/lib/api.ts` | Added `getMcpTools(): Promise<unknown[]>` — GET /api/mcp/tools. |
| 6 | `src/components/WorkoutChart.tsx` | Chart container: `overflow: 'hidden'` → `overflowX: 'auto', overflowY: 'hidden'`. Dense workouts scroll instead of clipping. |
| 7 | `src/components/WorkoutChart.tsx` | Watts display now uses `formatWatts()` from `lib/format` instead of inline `Math.round(...)+'w'`. |

New tests added:
- `WorkoutChart.test.tsx`: Enter selects bar + updates readout; Space selects bar + updates readout; only one bar has tabIndex 0 at a time.
- `api.test.ts`: 204 response resolves without throwing (mocked fetch returning status 204 with no body).
