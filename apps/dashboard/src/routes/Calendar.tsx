import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import AppShell from '../components/AppShell';
import MonthGrid from '../components/calendar/MonthGrid';
import SportIcon, { sportColor } from '../components/calendar/SportIcon';
import { useLongPressDrag } from '../components/calendar/useLongPressDrag';
import ActivityDrawer from '../components/calendar/ActivityDrawer';
import WorkoutChart from '../components/WorkoutChart';
import { ZoneDot, ComplianceDot, type Zone } from '../components/viz';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { getEvents, getActivities, moveEvent } from '../lib/api';
import { formatDuration, formatDistance, ftpToZone, DEFAULT_FTP } from '../lib/format';
import type { PlannedEvent, Activity, WorkoutStep } from '../lib/types';

// ── Date helpers ─────────────────────────────────────────────────────────────

function toIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(iso: string): string {
  // Sunday of the week containing `iso`
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(year: number, month: number): string {
  return toIso(year, month, 1);
}

function lastOfMonth(year: number, month: number): string {
  return toIso(year, month, new Date(year, month + 1, 0).getDate());
}

/** Range covering 8 weeks back to 9 weeks forward, for the scrollable week strip. */
function weekRangeForScroll(): { oldest: string; newest: string } {
  const todayIso = new Date().toISOString().slice(0, 10);
  return {
    oldest: addDays(startOfWeek(todayIso), -56),
    newest: addDays(startOfWeek(todayIso), 7 * 9),
  };
}

// ── Item classification ──────────────────────────────────────────────────────

function isRestrictedActivity(a: Activity): boolean {
  const src = (a as Record<string, unknown>).source as string | undefined;
  if (src === 'STRAVA') return true;
  if ((a as Record<string, unknown>)._note) return true;
  if (!a.name) return true;
  return false;
}

function isDone(ev: PlannedEvent | Activity): boolean {
  return ev.category === 'ACTIVITY' || ev.category === 'DONE';
}

/** Training load (TSS) for an item, rounded; null when absent. */
function tssOf(ev: PlannedEvent | Activity): number | null {
  const raw = ev.icu_training_load ?? (ev as Record<string, unknown>).load_target as number | undefined;
  return raw != null ? Math.round(raw as number) : null;
}

/** Peak %FTP across a workout's steps (recursing into repeat blocks). */
function peakStepPct(steps: WorkoutStep[]): number {
  let peak = 0;
  for (const s of steps) {
    if (s.steps?.length) peak = Math.max(peak, peakStepPct(s.steps));
    const v = s.power?.value ?? s.power?.end ?? s.power?.start ?? 0;
    if (v > peak) peak = v;
  }
  return peak;
}

/**
 * Representative 1–5 zone for an item. Prefers the workout structure's peak
 * intensity, then icu_intensity (fraction → %), else endurance (zone 1).
 */
function deriveZone(ev: PlannedEvent | Activity): Zone {
  const steps = ev.workout_doc?.steps;
  if (steps?.length) {
    const peak = peakStepPct(steps);
    if (peak > 0) return ftpToZone(peak);
  }
  const intensity = ev.icu_intensity;
  if (intensity != null) {
    const pct = intensity <= 2 ? intensity * 100 : intensity;
    return ftpToZone(pct);
  }
  return 1;
}

/**
 * Plain-English one-liner for a workout's structure, e.g.
 * "3 sets · 12 min each · hard then steady". Derived from the largest repeat
 * block; falls back to a coarse intensity read when there's no repeat.
 */
function workoutSummary(steps: WorkoutStep[]): string | null {
  const block = steps.find(s => (s.reps ?? 0) > 1 && (s.steps?.length ?? 0) > 0);
  if (block) {
    const work = block.steps!.reduce(
      (a, s) => (s.duration ?? 0) > (a.duration ?? 0) ? s : a,
      block.steps![0],
    );
    const mins = Math.round((work.duration ?? 0) / 60);
    const tail = ftpToZone(peakStepPct(block.steps!)) >= 3 ? 'hard then steady' : 'steady';
    return `${block.reps} sets · ${mins} min each · ${tail}`;
  }
  const peak = peakStepPct(steps);
  if (peak <= 0) return null;
  const mins = Math.round(steps.reduce((a, s) => a + (s.duration ?? 0), 0) / 60);
  return ftpToZone(peak) >= 3 ? `~${mins} min · structured intensity` : `~${mins} min · steady endurance`;
}

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Static color key for the month-grid zone dots. */
const ZONE_LEGEND: ReadonlyArray<[string, string]> = [
  ['#3b82f6', 'Endurance'],
  ['#f97316', 'Threshold'],
  ['#a855f7', 'Anaerobic'],
  ['#f97316', 'Race'],
];

// ── Merged day items ──────────────────────────────────────────────────────────

interface DayItems {
  planned: PlannedEvent[];
  completed: Activity[];
  plannedTss: number;
  actualTss: number;
}

function mergeDayItems(
  events: PlannedEvent[],
  activities: Activity[],
): Record<string, DayItems> {
  const byDate: Record<string, DayItems> = {};
  const ensure = (d: string) => {
    if (!byDate[d]) byDate[d] = { planned: [], completed: [], plannedTss: 0, actualTss: 0 };
    return byDate[d];
  };

  for (const ev of events) {
    const d = ev.start_date_local?.slice(0, 10);
    if (!d) continue;
    const bucket = ensure(d);
    if (isDone(ev)) {
      bucket.completed.push(ev as Activity);
      bucket.actualTss += tssOf(ev) ?? 0;
    } else {
      bucket.planned.push(ev);
      bucket.plannedTss += tssOf(ev) ?? 0;
    }
  }

  for (const act of activities) {
    if (isRestrictedActivity(act)) continue;
    const d = act.start_date_local?.slice(0, 10);
    if (!d) continue;
    const bucket = ensure(d);
    if (bucket.completed.some(a => String(a.id) === String(act.id))) continue;
    bucket.completed.push(act);
    bucket.actualTss += tssOf(act) ?? 0;
  }

  return byDate;
}

// ── Week strip (TrainingPeaks planned-vs-actual) ───────────────────────────────

interface WeekStripProps {
  weekStart: string; // ISO Sunday
  dayItems: Record<string, DayItems>;
  todayIso: string;
  selectedDate: string;
  onSelectDay: (date: string) => void;
  onCellRef?: (date: string, el: HTMLButtonElement | null) => void;
  highlightDate?: string | null;
}

function WeekStrip({
  weekStart,
  dayItems,
  todayIso,
  selectedDate,
  onSelectDay,
  onCellRef,
  highlightDate,
}: WeekStripProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Scale bars against the busiest day in the visible week (min ceiling so a
  // light planned day still shows a visible sliver).
  const maxTss = Math.max(
    60,
    ...days.map(d => Math.max(dayItems[d]?.plannedTss ?? 0, dayItems[d]?.actualTss ?? 0)),
  );
  const BAR_H = 48;

  return (
    <div className="grid grid-cols-7 gap-0.5 px-1 pt-2" data-testid="week-strip">
      {days.map((iso, i) => {
        const isToday = iso === todayIso;
        const isSelected = iso === selectedDate;
        const isHighlight = iso === highlightDate;
        const items = dayItems[iso];
        const plannedTss = items?.plannedTss ?? 0;
        const actualTss = items?.actualTss ?? 0;
        const plannedH = Math.round((plannedTss / maxTss) * BAR_H);
        const actualH = Math.round((actualTss / maxTss) * BAR_H);
        const dayNum = parseInt(iso.slice(8), 10);
        const total = (items?.planned.length ?? 0) + (items?.completed.length ?? 0);
        // Hard day: a heavy planned session. Presentational accent only.
        const isHardDay = plannedTss >= 70;

        return (
          <button
            key={iso}
            ref={el => onCellRef?.(iso, el)}
            data-date={iso}
            onClick={() => onSelectDay(iso)}
            className="flex min-h-[44px] flex-col items-center gap-1 rounded-md px-0.5 pb-1 pt-1 transition-colors"
            style={{
              background: isHighlight ? 'rgba(249,115,22,0.15)' : 'transparent',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderTopColor: isSelected ? 'var(--brand)' : 'transparent',
              borderRightColor: isSelected ? 'var(--brand)' : 'transparent',
              borderBottomColor: isSelected ? 'var(--brand)' : 'transparent',
              borderLeftWidth: isHardDay ? '2px' : '1px',
              borderLeftColor: isHardDay ? '#f97316' : (isSelected ? 'var(--brand)' : 'transparent'),
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
            aria-label={`${iso}${isToday ? ' (today)' : ''}, planned ${plannedTss} TSS, actual ${actualTss} TSS${total > 0 ? `, ${total} item${total > 1 ? 's' : ''}` : ''}`}
            aria-pressed={isSelected}
          >
            <span
              className="text-[11px] font-semibold uppercase"
              style={{ color: isToday ? 'var(--brand)' : 'var(--text-dim)' }}
            >
              {DOW_LABELS[i]}
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[13px]"
              style={{
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--bg)' : 'var(--text)',
                background: isToday ? 'var(--brand)' : 'transparent',
              }}
            >
              {dayNum}
            </span>

            {/* Planned (light) bar with actual (filled) overlaid */}
            <span
              className="relative flex w-full items-end justify-center"
              style={{ height: BAR_H }}
              aria-hidden="true"
            >
              <span
                className="absolute bottom-0 w-3.5 rounded-sm"
                style={{
                  height: Math.max(plannedTss > 0 ? 3 : 0, plannedH),
                  background: 'rgba(148,163,184,0.30)',
                }}
              />
              <span
                className="absolute bottom-0 w-3.5 rounded-sm"
                style={{
                  height: Math.max(actualTss > 0 ? 3 : 0, actualH),
                  background: 'var(--brand)',
                }}
              />
            </span>

            <ComplianceDot planned={plannedTss} actual={actualTss} />
          </button>
        );
      })}
    </div>
  );
}

// ── Week header (single visible week + prev/next nav) ──────────────────────────

interface WeekHeaderProps {
  weekStart: string;
  dayItems: Record<string, DayItems>;
  todayIso: string;
  selectedDate: string;
  onSelectDay: (date: string) => void;
  onCellRef?: (date: string, el: HTMLButtonElement | null) => void;
  highlightDate?: string | null;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

function WeekHeader({
  weekStart,
  dayItems,
  todayIso,
  selectedDate,
  onSelectDay,
  onCellRef,
  highlightDate,
  onPrevWeek,
  onNextWeek,
}: WeekHeaderProps) {
  const d = new Date(weekStart + 'T00:00:00');
  const isCurrentWeek = todayIso >= weekStart && todayIso <= addDays(weekStart, 6);
  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between px-2 pb-0.5 pt-2">
        <button
          onClick={onPrevWeek}
          aria-label="Previous week"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span
          className="text-xs font-semibold"
          style={{ color: isCurrentWeek ? 'var(--brand)' : 'var(--text-dim)' }}
        >
          {MONTH_NAMES[d.getMonth()].slice(0, 3)} {d.getFullYear()}
          {isCurrentWeek && <span className="ml-2 text-[10px] uppercase tracking-wide">this week</span>}
        </span>
        <button
          onClick={onNextWeek}
          aria-label="Next week"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      <WeekStrip
        weekStart={weekStart}
        dayItems={dayItems}
        todayIso={todayIso}
        selectedDate={selectedDate}
        onSelectDay={onSelectDay}
        onCellRef={onCellRef}
        highlightDate={highlightDate}
      />
      <div className="h-2" />
    </div>
  );
}

// ── Day list row ─────────────────────────────────────────────────────────────

interface DayRowProps {
  item: PlannedEvent | Activity;
  done: boolean;
  date: string;
  draggingId?: string | number | null;
  onOpen: (item: PlannedEvent | Activity) => void;
  onEventLongPress?: (e: React.PointerEvent, ev: PlannedEvent, date: string) => void;
}

function DayRow({ item, done, date, draggingId, onOpen, onEventLongPress }: DayRowProps) {
  const zone = deriveZone(item);
  const tss = tssOf(item);
  const isBeingDragged = draggingId != null && String(item.id) === String(draggingId);
  const steps = item.workout_doc?.steps ?? [];
  const summary = !done && steps.length ? workoutSummary(steps) : null;

  return (
    <li
      data-testid="agenda-event-row"
      data-event-id={item.id}
      className="aura-glass aura-edge-light overflow-hidden rounded-2xl"
      style={{
        borderLeft: '3px solid #f97316',
        transform: isBeingDragged ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 120ms',
      }}
    >
      <button
        onClick={() => onOpen(item)}
        onPointerDown={done ? undefined : e => onEventLongPress?.(e, item as PlannedEvent, date)}
        aria-label={`${item.name} — ${done ? 'completed' : 'planned'}`}
        className="flex w-full items-center gap-3 p-3 text-left"
        style={{
          background: 'transparent',
          touchAction: done ? 'manipulation' : 'none',
          minHeight: 56,
        }}
      >
        <ZoneDot zone={zone} />
        <span className="shrink-0" style={{ lineHeight: 0 }}>
          <SportIcon type={item.type} size={20} color={sportColor(item.type)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-foreground">{item.name}</span>
          <span className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
            {tss != null && <span className="font-mono">{tss} TSS</span>}
            <span>{done ? 'Completed' : 'Planned'}</span>
            {item.moving_time != null && <span>· {formatDuration(item.moving_time)}</span>}
            {item.distance != null && item.distance > 0 && <span>· {formatDistance(item.distance)}</span>}
          </span>
        </span>
        {done ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            Achievable
          </span>
        ) : (
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}
          >
            Achievable
          </span>
        )}
      </button>

      {steps.length > 0 && (
        <div className="px-3 pb-3">
          <WorkoutChart steps={steps} ftp={(item as PlannedEvent).icu_ftp ?? DEFAULT_FTP} />
          {summary && <p className="mt-2 text-[13px] text-muted-foreground">{summary}</p>}
        </div>
      )}
    </li>
  );
}

// ── Day list ─────────────────────────────────────────────────────────────────

interface DayListProps {
  date: string;
  items: DayItems | null;
  draggingId?: string | number | null;
  onOpen: (item: PlannedEvent | Activity) => void;
  onEventLongPress?: (e: React.PointerEvent, ev: PlannedEvent, date: string) => void;
}

function DayList({ date, items, draggingId, onOpen, onEventLongPress }: DayListProps) {
  const planned = items?.planned ?? [];
  const completed = items?.completed ?? [];
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  });
  const total = planned.length + completed.length;

  return (
    <div className="px-3 pt-3" data-testid="day-list" style={{ paddingBottom: 80 }}>
      <p
        className="mb-2 text-[11px] font-semibold uppercase tracking-widest"
        style={{ color: 'var(--brand)' }}
      >
        {label}
      </p>

      {planned.length === 0 && completed.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing scheduled or logged.</p>
      )}

      {planned.length > 0 && (
        <>
          <p className="mb-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Planned
          </p>
          <ul className="mb-3 space-y-2" role="list">
            {planned.map(ev => (
              <DayRow
                key={ev.id}
                item={ev}
                done={false}
                date={date}
                draggingId={draggingId}
                onOpen={onOpen}
                onEventLongPress={onEventLongPress}
              />
            ))}
          </ul>
        </>
      )}

      {completed.length > 0 && (
        <>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Completed
          </p>
          <ul className="space-y-2" role="list">
            {completed.map(act => (
              <DayRow key={act.id} item={act} done date={date} onOpen={onOpen} />
            ))}
          </ul>
        </>
      )}

      {total === 1 && (
        <p className="mt-3 text-[13px] text-muted-foreground">No other activities today</p>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCalendar() {
  return (
    <div className="px-1 pt-2">
      <Skeleton className="mb-2 ml-2 h-3 w-16" />
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-md" />
        ))}
      </div>
      <div className="mt-4 space-y-2 px-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

const VIEW_KEY = 'cal_view';

export default function Calendar() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  const [view, setView] = useState<'week' | 'month'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'month' ? 'month' : 'week';
    } catch {
      return 'week';
    }
  });

  function switchView(v: 'week' | 'month') {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Selected day drives the day list; defaults to today.
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);

  // Activity detail drawer
  const [drawerItem, setDrawerItem] = useState<PlannedEvent | Activity | null>(null);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cellRefs = useRef<Map<string, DOMRect>>(new Map());

  const { oldest: weekOldest, newest: weekNewest } = weekRangeForScroll();
  const monthOldest = firstOfMonth(viewYear, viewMonth);
  const monthNewest = lastOfMonth(viewYear, viewMonth);

  const rangeOldest = view === 'week' ? weekOldest : monthOldest;
  const rangeNewest = view === 'week' ? weekNewest : monthNewest;

  const { data: events, isLoading: evLoading, isError: evError, refetch } = useQuery<PlannedEvent[]>({
    queryKey: ['events', rangeOldest, rangeNewest],
    queryFn: () => getEvents(rangeOldest, rangeNewest),
  });

  const { data: activities, isLoading: actLoading } = useQuery<Activity[]>({
    queryKey: ['activities', rangeOldest, rangeNewest],
    queryFn: () => getActivities({
      oldest: rangeOldest,
      newest: rangeNewest,
      limit: 200,
      include_unnamed: 1,
    }).catch(() => [] as Activity[]),
  });

  const isLoading = evLoading || actLoading;

  const dayItems = useMemo(
    () => mergeDayItems(events ?? [], activities ?? []),
    [events, activities],
  );

  // MonthGrid wants a flat PlannedEvent[] per date.
  const eventsByDate = useMemo(() => {
    const out: Record<string, PlannedEvent[]> = {};
    for (const [d, items] of Object.entries(dayItems)) {
      out[d] = [...items.planned, ...items.completed] as PlannedEvent[];
    }
    return out;
  }, [dayItems]);

  // Drag hit-testing infrastructure (reused from prior implementation).
  useEffect(() => {
    function updateRects() {
      document.querySelectorAll<HTMLButtonElement>('button[data-date]').forEach(el => {
        const date = el.getAttribute('data-date');
        if (date) cellRefs.current.set(date, el.getBoundingClientRect());
      });
    }
    window.addEventListener('scroll', updateRects, { passive: true });
    window.addEventListener('resize', updateRects, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateRects);
      window.removeEventListener('resize', updateRects);
    };
  }, []);

  const handleCellRef = useCallback((date: string, el: HTMLButtonElement | null) => {
    if (el) cellRefs.current.set(date, el.getBoundingClientRect());
    else cellRefs.current.delete(date);
  }, []);

  const dateFromPoint = useCallback((x: number, y: number): string | null => {
    for (const [date, rect] of cellRefs.current.entries()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return date;
    }
    return null;
  }, []);

  const { onPointerDown } = useLongPressDrag({
    onMove: async (eventId, newDate) => {
      queryClient.setQueryData<PlannedEvent[]>(['events', rangeOldest, rangeNewest], old => {
        if (!old) return old;
        return old.map(ev => {
          if (String(ev.id) !== String(eventId)) return ev;
          const time = ev.start_date_local?.slice(10) ?? 'T00:00:00';
          return { ...ev, start_date_local: newDate + time };
        });
      });
      try {
        await moveEvent(eventId, newDate);
      } finally {
        refetch();
      }
      setDraggingId(null);
    },
    onTap: eventId => {
      const found = (events ?? []).find(e => String(e.id) === String(eventId))
        ?? (activities ?? []).find(a => String(a.id) === String(eventId));
      if (found) setDrawerItem(found);
    },
    onDragStart: eventId => setDraggingId(eventId),
    onDragEnd: () => { setDraggingId(null); setHighlightDate(null); },
    dateFromPoint,
  });

  useEffect(() => {
    function onDragOver(e: Event) {
      setHighlightDate((e as CustomEvent<{ date: string | null }>).detail.date ?? null);
    }
    document.addEventListener('calendar:drag-over', onDragOver);
    return () => document.removeEventListener('calendar:drag-over', onDragOver);
  }, []);

  function handleEventLongPress(e: React.PointerEvent, ev: PlannedEvent, originDate: string) {
    onPointerDown(e, ev.id, originDate);
  }

  // Selecting a day filters the list below; in week view it keeps the day's week visible.
  function handleSelectDay(date: string) {
    setSelectedDate(date);
  }

  function prevWeek() {
    const ns = addDays(startOfWeek(selectedDate), -7);
    setSelectedDate(ns);
  }
  function nextWeek() {
    const ns = addDays(startOfWeek(selectedDate), 7);
    setSelectedDate(ns);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const selectedItems = dayItems[selectedDate] ?? null;
  const ftp = (drawerItem as PlannedEvent & { icu_ftp?: number })?.icu_ftp ?? DEFAULT_FTP;

  return (
    <AppShell title="Calendar">
      {/* Sticky header: month label / nav + view toggle + add */}
      <div
        className="sticky z-10 flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', top: 'calc(56px + env(safe-area-inset-top))' }}
      >
        {view === 'month' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="min-w-[130px] text-center text-2xl font-bold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md"
              style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        ) : (
          <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
          </span>
        )}

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={v => switchView(v as 'week' | 'month')}>
            <TabsList className="h-8 rounded-full">
              <TabsTrigger value="week" className="h-7 rounded-full px-3 text-xs text-slate-300">Week</TabsTrigger>
              <TabsTrigger value="month" className="h-7 rounded-full px-3 text-xs text-slate-300">Month</TabsTrigger>
            </TabsList>
            {/* Empty panels so radix's aria-controls points at real elements
                (validates ARIA); the views render below, not inside these. */}
            <TabsContent value="week" />
            <TabsContent value="month" />
          </Tabs>

          <button
            onClick={() => navigate('/library')}
            aria-label="Add workout"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'var(--brand)', color: 'var(--bg)', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-2)' }}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonCalendar />
      ) : evError ? (
        <div className="p-4 text-center">
          <p className="mb-3 text-sm" style={{ color: 'var(--text-dim)' }}>Could not load calendar events.</p>
          <button
            onClick={() => refetch()}
            className="rounded px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--bg)', border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      ) : view === 'week' ? (
        <>
          <WeekHeader
            weekStart={startOfWeek(selectedDate)}
            dayItems={dayItems}
            todayIso={todayIso}
            selectedDate={selectedDate}
            onSelectDay={handleSelectDay}
            onCellRef={handleCellRef}
            highlightDate={highlightDate}
            onPrevWeek={prevWeek}
            onNextWeek={nextWeek}
          />
          <DayList
            date={selectedDate}
            items={selectedItems}
            draggingId={draggingId}
            onOpen={setDrawerItem}
            onEventLongPress={handleEventLongPress}
          />
        </>
      ) : (
        <>
          <div className="px-1 pb-2">
            <MonthGrid
              year={viewYear}
              month={viewMonth}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              onSelectDay={handleSelectDay}
              onCellRef={handleCellRef}
              onEventLongPress={handleEventLongPress}
              highlightDate={highlightDate}
            />
          </div>
          <ul className="flex flex-wrap gap-3 px-3 pb-2" aria-label="Zone legend">
            {ZONE_LEGEND.map(([color, label]) => (
              <li key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </li>
            ))}
          </ul>
          <DayList
            date={selectedDate}
            items={selectedItems}
            draggingId={draggingId}
            onOpen={setDrawerItem}
            onEventLongPress={handleEventLongPress}
          />
        </>
      )}

      <ActivityDrawer
        item={drawerItem}
        ftp={ftp}
        open={drawerItem != null}
        onClose={() => setDrawerItem(null)}
        onOpenFull={id => { setDrawerItem(null); navigate(`/workout/${id}`); }}
      />
    </AppShell>
  );
}
