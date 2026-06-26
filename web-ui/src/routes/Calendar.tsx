import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus } from 'lucide-react';
import AppShell from '../components/AppShell';
import MonthGrid from '../components/calendar/MonthGrid';
import SportIcon, { sportColor } from '../components/calendar/SportIcon';
import { useLongPressDrag } from '../components/calendar/useLongPressDrag';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { getEvents, getActivities, moveEvent } from '../lib/api';
import { formatDuration, formatDate, formatDistance } from '../lib/format';
import type { PlannedEvent, Activity } from '../lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────

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
  // Returns the Sunday of the week containing `iso`
  const d = new Date(iso + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function firstOfMonth(year: number, month: number): string {
  return toIso(year, month, 1);
}

function lastOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return toIso(year, month, last);
}

/** Inclusive date range [oldest, newest] covering N weeks around today */
function weekRangeForScroll(): { oldest: string; newest: string } {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  // 8 weeks back, 8 weeks forward
  const oldest = addDays(startOfWeek(todayIso), -56);
  const newest = addDays(startOfWeek(todayIso), 7 * 9);
  return { oldest, newest };
}

function isRestrictedActivity(a: Activity): boolean {
  // Drop Strava-sourced activities — they come back with null data due to API restrictions
  const src = (a as Record<string, unknown>).source as string | undefined;
  if (src === 'STRAVA') return true;
  const note = (a as Record<string, unknown>)._note as string | undefined;
  if (note) return true;
  if (!a.name) return true;
  return false;
}

function isDone(ev: PlannedEvent | Activity): boolean {
  return ev.category === 'ACTIVITY' || ev.category === 'DONE';
}

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Merged day items ──────────────────────────────────────────────────────

interface DayItems {
  planned: PlannedEvent[];
  completed: Activity[];
}

function mergeDayItems(
  events: PlannedEvent[],
  activities: Activity[],
): Record<string, DayItems> {
  const byDate: Record<string, DayItems> = {};

  const ensure = (d: string) => {
    if (!byDate[d]) byDate[d] = { planned: [], completed: [] };
  };

  for (const ev of events) {
    const d = ev.start_date_local?.slice(0, 10);
    if (!d) continue;
    ensure(d);
    if (isDone(ev)) {
      byDate[d].completed.push(ev as Activity);
    } else {
      byDate[d].planned.push(ev);
    }
  }

  for (const act of activities) {
    if (isRestrictedActivity(act)) continue;
    const d = act.start_date_local?.slice(0, 10);
    if (!d) continue;
    ensure(d);
    // Check if this activity is already paired with a planned event
    const alreadyPresent = byDate[d].completed.some(a => String(a.id) === String(act.id));
    if (!alreadyPresent) {
      byDate[d].completed.push(act);
    }
  }

  return byDate;
}

// ── Week row ───────────────────────────────────────────────────────────────

interface WeekRowProps {
  weekStart: string; // ISO of Sunday
  dayItems: Record<string, DayItems>;
  todayIso: string;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onCellRef?: (date: string, el: HTMLButtonElement | null) => void;
  onEventLongPress?: (e: React.PointerEvent, ev: PlannedEvent, originDate: string) => void;
  highlightDate?: string | null;
}

function WeekRow({
  weekStart,
  dayItems,
  todayIso,
  selectedDate,
  onSelectDay,
  onCellRef,
  onEventLongPress,
  highlightDate,
}: WeekRowProps) {
  return (
    <div className="grid grid-cols-7 gap-0.5">
      {Array.from({ length: 7 }).map((_, i) => {
        const iso = addDays(weekStart, i);
        const isToday = iso === todayIso;
        const isSelected = iso === selectedDate;
        const isHighlight = iso === highlightDate;
        const items = dayItems[iso];
        const planned = items?.planned ?? [];
        const completed = items?.completed ?? [];
        const allItems = [...planned, ...completed];
        const displayItems = allItems.slice(0, 3);
        const overflow = allItems.length - displayItems.length;
        const dayNum = parseInt(iso.slice(8), 10);

        return (
          <button
            key={iso}
            ref={el => onCellRef?.(iso, el)}
            data-date={iso}
            onClick={() => onSelectDay(iso)}
            className="flex min-h-[56px] flex-col items-center gap-0.5 rounded p-1 transition-colors"
            style={{
              background: isSelected
                ? 'var(--surface-2)'
                : isHighlight
                  ? 'rgba(240,165,0,0.15)'
                  : 'transparent',
              border: isHighlight ? '2px solid var(--brand)' : '1px solid transparent',
              touchAction: 'manipulation',
              cursor: 'pointer',
            }}
            aria-label={`${iso}${isToday ? ' (today)' : ''}${allItems.length > 0 ? `, ${allItems.length} event${allItems.length > 1 ? 's' : ''}` : ''}`}
            aria-pressed={isSelected}
          >
            {/* Date badge */}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px]"
              style={{
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--bg)' : isSelected ? 'var(--brand)' : 'var(--text)',
                background: isToday ? 'var(--brand)' : 'transparent',
                border: isToday ? 'none' : isSelected ? '2px solid var(--brand)' : '2px solid transparent',
              }}
            >
              {dayNum}
            </span>

            {/* Sport icon indicators */}
            {displayItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-0.5">
                {displayItems.map(ev => {
                  const done = isDone(ev);
                  return (
                    <span
                      key={ev.id}
                      data-testid="sport-glyph-indicator"
                      onPointerDown={e => {
                        if (!done) {
                          e.stopPropagation();
                          onEventLongPress?.(e, ev as PlannedEvent, iso);
                        }
                      }}
                      style={{ touchAction: 'none', lineHeight: 0, opacity: done ? 1 : 0.85 }}
                    >
                      <SportIcon
                        type={ev.type}
                        size={13}
                        color={sportColor(ev.type)}
                      />
                    </span>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[9px] leading-none" style={{ color: 'var(--text-dim)' }}>
                    +{overflow}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Week label ─────────────────────────────────────────────────────────────

function WeekLabel({ weekStart, todayIso }: { weekStart: string; todayIso: string }) {
  const d = new Date(weekStart + 'T00:00:00');
  const month = d.getMonth();
  const year = d.getFullYear();
  const isCurrentWeek =
    todayIso >= weekStart && todayIso <= addDays(weekStart, 6);

  return (
    <div
      className="px-3 pb-1 pt-3 text-xs font-semibold"
      style={{ color: isCurrentWeek ? 'var(--brand)' : 'var(--text-dim)' }}
    >
      {MONTH_NAMES[month].slice(0, 3)} {year}
      {isCurrentWeek && <span className="ml-2 text-[10px] uppercase tracking-wide" style={{ color: 'var(--brand)' }}>this week</span>}
    </div>
  );
}

// ── Week scroll view ──────────────────────────────────────────────────────

interface WeekScrollProps {
  dayItems: Record<string, DayItems>;
  todayIso: string;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onCellRef?: (date: string, el: HTMLButtonElement | null) => void;
  onEventLongPress?: (e: React.PointerEvent, ev: PlannedEvent, originDate: string) => void;
  highlightDate?: string | null;
}

function WeekScroll({
  dayItems,
  todayIso,
  selectedDate,
  onSelectDay,
  onCellRef,
  onEventLongPress,
  highlightDate,
}: WeekScrollProps) {
  const currentWeekStart = startOfWeek(todayIso);
  const todayRowRef = useRef<HTMLDivElement>(null);

  // Build list of weeks: 8 past + current + 8 future = 17 weeks
  const weeks: string[] = [];
  for (let w = -8; w <= 8; w++) {
    weeks.push(addDays(currentWeekStart, w * 7));
  }

  useEffect(() => {
    if (todayRowRef.current && typeof todayRowRef.current.scrollIntoView === 'function') {
      todayRowRef.current.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, []);

  return (
    <div>
      {/* DOW header */}
      <div className="grid grid-cols-7 border-b px-1 py-1" style={{ borderColor: 'var(--border)' }}>
        {DOW_LABELS.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="px-1">
        {weeks.map(weekStart => {
          const isCurrent = weekStart === currentWeekStart;
          return (
            <div
              key={weekStart}
              ref={isCurrent ? todayRowRef : undefined}
              className="border-b"
              style={{
                borderColor: 'var(--border)',
                background: isCurrent ? 'rgba(240,165,0,0.04)' : 'transparent',
              }}
            >
              <WeekLabel weekStart={weekStart} todayIso={todayIso} />
              <WeekRow
                weekStart={weekStart}
                dayItems={dayItems}
                todayIso={todayIso}
                selectedDate={selectedDate}
                onSelectDay={onSelectDay}
                onCellRef={onCellRef}
                onEventLongPress={onEventLongPress}
                highlightDate={highlightDate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Day detail Sheet ──────────────────────────────────────────────────────

interface DaySheetProps {
  date: string | null;
  items: DayItems | null;
  draggingId?: string | number | null;
  open: boolean;
  onClose: () => void;
  onEventLongPress?: (e: React.PointerEvent, ev: PlannedEvent, date: string) => void;
}

function DaySheet({ date, items, draggingId, open, onClose, onEventLongPress }: DaySheetProps) {
  const navigate = useNavigate();

  const planned = items?.planned ?? [];
  const completed = items?.completed ?? [];

  const label = date ? formatDate(date + 'T00:00:00') : '';

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto pb-safe">
        <SheetHeader className="mb-4 pr-8">
          <SheetTitle>{label}</SheetTitle>
        </SheetHeader>

        {planned.length === 0 && completed.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No workouts for this day.</p>
        )}

        {planned.length > 0 && (
          <section className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Planned</p>
            <ul className="space-y-2" role="list">
              {planned.map(ev => {
                const isBeingDragged = draggingId != null && String(ev.id) === String(draggingId);
                return (
                  <li key={ev.id} data-testid="agenda-event-row" data-event-id={ev.id}>
                    <button
                      onClick={() => { onClose(); navigate(`/workout/${ev.id}`); }}
                      onPointerDown={e => date && onEventLongPress?.(e, ev, date)}
                      aria-label={`${ev.name} — planned`}
                      className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
                      style={{
                        background: isBeingDragged ? 'var(--surface-2)' : 'var(--surface)',
                        border: '1px solid var(--border)',
                        touchAction: 'none',
                        transform: isBeingDragged ? 'scale(1.03)' : 'scale(1)',
                        minHeight: 56,
                      }}
                    >
                      <span className="shrink-0" style={{ lineHeight: 0 }}>
                        <SportIcon type={ev.type} size={22} color={sportColor(ev.type)} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                          {ev.name}
                        </span>
                        <span className="flex gap-2 text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                          {ev.moving_time != null && <span>{formatDuration(ev.moving_time)}</span>}
                          {ev.icu_training_load != null && <span>{Math.round(ev.icu_training_load)} TSS</span>}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]" style={{ color: 'var(--brand)', borderColor: 'rgba(240,165,0,0.4)' }}>
                        planned
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {completed.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>Completed</p>
            <ul className="space-y-2" role="list">
              {completed.map(act => (
                <li key={act.id} data-testid="agenda-event-row" data-event-id={act.id}>
                  <button
                    onClick={() => { onClose(); navigate(`/workout/${act.id}`); }}
                    aria-label={`${act.name} — completed`}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      minHeight: 56,
                    }}
                  >
                    <span className="shrink-0" style={{ lineHeight: 0 }}>
                      <SportIcon type={act.type} size={22} color={sportColor(act.type)} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[15px] font-medium" style={{ color: 'var(--text)' }}>
                        {act.name}
                      </span>
                      <span className="flex gap-2 text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                        {act.moving_time != null && <span>{formatDuration(act.moving_time)}</span>}
                        {act.distance != null && act.distance > 0 && <span>{formatDistance(act.distance)}</span>}
                        {act.icu_training_load != null && <span>{Math.round(act.icu_training_load)} TSS</span>}
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold rounded px-2 py-0.5" style={{ background: 'rgba(82,199,127,0.15)', color: 'var(--z2)' }}>
                      <CheckCircle2 className="h-3 w-3" />
                      done
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonWeek() {
  return (
    <div className="px-1">
      {Array.from({ length: 5 }).map((_, wi) => (
        <div key={wi} className="border-b py-2" style={{ borderColor: 'var(--border)' }}>
          <Skeleton className="mb-1 ml-3 h-3 w-16" />
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 7 }).map((_, di) => (
              <Skeleton key={di} className="h-14 rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────

const VIEW_KEY = 'cal_view';

export default function Calendar() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);

  // View: 'week' or 'month'
  const [view, setView] = useState<'week' | 'month'>(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      return stored === 'month' ? 'month' : 'week';
    } catch {
      return 'week';
    }
  });

  function switchView(v: 'week' | 'month') {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }

  // Month view navigation
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Day detail sheet
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cellRefs = useRef<Map<string, DOMRect>>(new Map());

  // Compute query range
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

  const dayItems = mergeDayItems(events ?? [], activities ?? []);

  // For MonthGrid: build a flat PlannedEvent[] keyed by date (all items)
  const eventsByDate: Record<string, PlannedEvent[]> = {};
  for (const [d, items] of Object.entries(dayItems)) {
    eventsByDate[d] = [...items.planned, ...items.completed] as PlannedEvent[];
  }

  // Drag infrastructure
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
    if (el) {
      cellRefs.current.set(date, el.getBoundingClientRect());
    } else {
      cellRefs.current.delete(date);
    }
  }, []);

  const dateFromPoint = useCallback((x: number, y: number): string | null => {
    for (const [date, rect] of cellRefs.current.entries()) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return date;
      }
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
      navigate(`/workout/${eventId}`);
    },
    onDragStart: eventId => {
      setDraggingId(eventId);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setHighlightDate(null);
    },
    dateFromPoint,
  });

  useEffect(() => {
    function onDragOver(e: Event) {
      const date = (e as CustomEvent<{ date: string | null }>).detail.date;
      setHighlightDate(date ?? null);
    }
    document.addEventListener('calendar:drag-over', onDragOver);
    return () => document.removeEventListener('calendar:drag-over', onDragOver);
  }, []);

  function handleEventLongPress(e: React.PointerEvent, ev: PlannedEvent, originDate: string) {
    onPointerDown(e, ev.id, originDate);
  }

  function handleSelectDay(date: string) {
    setSheetDate(date);
    setSheetOpen(true);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const sheetItems = sheetDate ? (dayItems[sheetDate] ?? { planned: [], completed: [] }) : null;

  return (
    <AppShell title="Calendar">
      {/* Header: month nav (month view only) + view toggle + add button — sticky so it stays visible while scrolling */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', top: 'calc(56px + env(safe-area-inset-top))' }}
      >
        {/* Left: month nav (only in month view) */}
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
            <span className="min-w-[130px] text-center text-[15px] font-semibold">
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
          <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
            {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <Tabs value={view} onValueChange={v => switchView(v as 'week' | 'month')}>
            <TabsList className="h-8">
              <TabsTrigger value="week" className="h-7 px-3 text-xs">Week</TabsTrigger>
              <TabsTrigger value="month" className="h-7 px-3 text-xs">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Add button */}
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
        <SkeletonWeek />
      ) : evError ? (
        <div className="p-4 text-center">
          <p className="mb-3 text-sm" style={{ color: 'var(--text-dim)' }}>
            Could not load calendar events.
          </p>
          <button
            onClick={() => refetch()}
            className="rounded px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--bg)', border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      ) : view === 'week' ? (
        <WeekScroll
          dayItems={dayItems}
          todayIso={todayIso}
          selectedDate={sheetDate}
          onSelectDay={handleSelectDay}
          onCellRef={handleCellRef}
          onEventLongPress={handleEventLongPress}
          highlightDate={highlightDate}
        />
      ) : (
        <div className="px-1 pb-2">
          <MonthGrid
            year={viewYear}
            month={viewMonth}
            eventsByDate={eventsByDate}
            selectedDate={sheetDate}
            onSelectDay={handleSelectDay}
            onCellRef={handleCellRef}
            onEventLongPress={handleEventLongPress}
            highlightDate={highlightDate}
          />
        </div>
      )}

      {/* Day detail sheet */}
      <DaySheet
        date={sheetDate}
        items={sheetItems}
        draggingId={draggingId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onEventLongPress={handleEventLongPress}
      />
    </AppShell>
  );
}
