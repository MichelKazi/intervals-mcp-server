import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import MonthGrid from '../components/calendar/MonthGrid';
import DayAgenda from '../components/calendar/DayAgenda';
import { useLongPressDrag } from '../components/calendar/useLongPressDrag';
import { getEvents, moveEvent } from '../lib/api';
import type { PlannedEvent } from '../lib/types';

function toIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function firstOfMonth(year: number, month: number): string {
  return toIso(year, month, 1);
}

function lastOfMonth(year: number, month: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return toIso(year, month, last);
}

function groupByDate(events: PlannedEvent[]): Record<string, PlannedEvent[]> {
  const map: Record<string, PlannedEvent[]> = {};
  for (const ev of events) {
    const date = ev.start_date_local?.slice(0, 10);
    if (!date) continue;
    if (!map[date]) map[date] = [];
    map[date].push(ev);
  }
  return map;
}

function SkeletonGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
        padding: 'var(--sp-2)',
        opacity: 0.4,
      }}
    >
      {Array.from({ length: 35 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 52,
            background: 'var(--surface-2)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      ))}
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Calendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    toIso(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [highlightDate, setHighlightDate] = useState<string | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const cellRefs = useRef<Map<string, DOMRect>>(new Map());

  const { data: events, isLoading, isError, refetch } = useQuery<PlannedEvent[]>({
    queryKey: ['events', viewYear, viewMonth],
    queryFn: () => getEvents(firstOfMonth(viewYear, viewMonth), lastOfMonth(viewYear, viewMonth)),
  });

  const eventsByDate = groupByDate(events ?? []);

  const agendaRef = useRef<HTMLDivElement>(null);

  function handleSelectDay(date: string) {
    setSelectedDate(date);
    setTimeout(() => agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const handleCellRef = useCallback((date: string, el: HTMLButtonElement | null) => {
    if (el) {
      cellRefs.current.set(date, el.getBoundingClientRect());
    } else {
      cellRefs.current.delete(date);
    }
  }, []);

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
      queryClient.setQueryData<PlannedEvent[]>(['events', viewYear, viewMonth], old => {
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
      setSelectedDate(newDate);
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

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const agendaEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  return (
    <AppShell title="Calendar">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sp-3) var(--sp-4)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span style={{ fontWeight: 600, fontSize: 16 }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/library')}
            aria-label="Add workout"
            style={{
              background: 'var(--accent)',
              border: 'none',
              color: 'var(--bg)',
              cursor: 'pointer',
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 22,
              boxShadow: 'var(--shadow-2)',
            }}
          >
            +
          </button>

          <button
            onClick={nextMonth}
            aria-label="Next month"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding: '0 var(--sp-2) var(--sp-2)' }}>
        {isLoading ? (
          <SkeletonGrid />
        ) : isError ? (
          <div style={{ padding: 'var(--sp-4)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)', marginBottom: 'var(--sp-3)' }}>
              Could not load calendar events.
            </p>
            <button
              onClick={() => refetch()}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: 'var(--bg)',
                padding: 'var(--sp-2) var(--sp-4)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        ) : (
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
        )}
      </div>

      <div
        ref={agendaRef}
        style={{
          borderTop: '2px solid var(--border)',
          minHeight: 120,
        }}
      >
        <DayAgenda
          date={selectedDate}
          events={agendaEvents}
          onEventLongPress={handleEventLongPress}
          draggingId={draggingId}
        />
      </div>
    </AppShell>
  );
}
