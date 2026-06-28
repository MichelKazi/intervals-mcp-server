import type { PlannedEvent } from '../../lib/types';
import { ZoneDot, type Zone } from '../viz';
import { ftpToZone } from '../../lib/format';

interface MonthGridProps {
  year: number;
  month: number; // 0-indexed
  eventsByDate: Record<string, PlannedEvent[]>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  /** Ref setter for a day cell element, used by drag hit-test */
  onCellRef?: (date: string, el: HTMLButtonElement | null) => void;
  /** Called when long-press drag starts on a glyph */
  onEventLongPress?: (e: React.PointerEvent, event: PlannedEvent, originDate: string) => void;
  highlightDate?: string | null;
}

const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Representative 1–5 zone from icu_intensity (fraction or %), else endurance. */
function eventZone(ev: PlannedEvent): Zone {
  const intensity = ev.icu_intensity;
  if (intensity != null) return ftpToZone(intensity <= 2 ? intensity * 100 : intensity);
  return 1;
}

export default function MonthGrid({
  year,
  month,
  eventsByDate,
  selectedDate,
  onSelectDay,
  onCellRef,
  onEventLongPress,
  highlightDate,
}: MonthGridProps) {
  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = firstOfMonth.getDay(); // 0=Sun

  // Build grid cells: leading empty + day cells
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, iso: toIso(year, month, d) });
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });

  return (
    <div style={{ userSelect: 'none' }}>
      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 'var(--sp-1)',
          marginBottom: 'var(--sp-1)',
        }}
      >
        {DOW_LABELS.map(d => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-dim)',
              fontWeight: 600,
              padding: 'var(--sp-1) 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 'var(--sp-1)',
          padding: 'var(--sp-1)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {cells.map((cell, idx) => {
          if (!cell.iso) {
            return <div key={`empty-${idx}`} style={{ minHeight: 52 }} />;
          }
          const iso = cell.iso;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const isHighlight = iso === highlightDate;
          const events = eventsByDate[iso] ?? [];
          const displayEvents = events.slice(0, 3);
          const totalTss = events.reduce(
            (sum, ev) => sum + (ev.icu_training_load != null ? Math.round(ev.icu_training_load) : 0),
            0,
          );
          // Days with training read as a heatmap: heavier load → stronger fill.
          const hasEvents = events.length > 0;
          const loadFill = hasEvents
            ? Math.min(0.22, 0.06 + (totalTss / 100) * 0.16)
            : 0;
          const cellBg = isSelected
            ? 'var(--surface-2)'
            : isHighlight
              ? 'var(--glass-bg)'
              : hasEvents
                ? `rgba(139, 92, 246, ${loadFill})`
                : 'transparent';

          return (
            <button
              key={iso}
              ref={el => onCellRef?.(iso, el)}
              data-date={iso}
              onClick={() => onSelectDay(iso)}
              className="aura-day-cell"
              style={{
                background: cellBg,
                border: isSelected || isHighlight
                  ? '1px solid var(--brand)'
                  : hasEvents
                    ? '1px solid var(--glass-border)'
                    : '1px solid transparent',
                boxShadow: isToday ? 'var(--glow-accent)' : undefined,
                cursor: 'pointer',
                minHeight: 52,
                minWidth: 0,
                padding: 'var(--sp-1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                touchAction: 'manipulation',
              }}
              aria-label={`${iso}${isToday ? ' (today)' : ''}${events.length > 0 ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}`}
              aria-pressed={isSelected}
            >
              {/* Date number with today ring */}
              <span
                style={{
                  width: 26,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--bg)' : isSelected ? 'var(--brand)' : 'var(--text)',
                  background: isToday ? 'var(--brand)' : 'transparent',
                  border: isToday ? 'none' : isSelected ? '2px solid var(--brand)' : '2px solid transparent',
                  flexShrink: 0,
                }}
              >
                {cell.day}
              </span>

              {/* Zone dots */}
              {events.length > 0 && (
                <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {displayEvents.map(ev => (
                    <span
                      key={ev.id}
                      data-testid="sport-glyph-indicator"
                      onPointerDown={e => {
                        e.stopPropagation();
                        onEventLongPress?.(e, ev, iso);
                      }}
                      style={{ touchAction: 'none', lineHeight: 0 }}
                    >
                      <ZoneDot zone={eventZone(ev)} size="sm" />
                    </span>
                  ))}
                </div>
              )}

              {/* Total TSS */}
              {totalTss > 0 && (
                <span className="text-[10px] text-slate-500 font-mono">{totalTss}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
