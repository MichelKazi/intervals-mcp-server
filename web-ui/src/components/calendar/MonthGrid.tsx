import type { PlannedEvent } from '../../lib/types';
import SportGlyph from './SportGlyph';

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

/** Sport-type to color token */
function sportColor(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('ride') || t.includes('bike') || t.includes('cycling') || t.includes('virtual') || t.includes('ebike')) return 'var(--z5)';
  if (t.includes('run') || t.includes('jog') || t.includes('trail')) return 'var(--z6)';
  if (t.includes('swim') || t.includes('pool') || t.includes('open_water')) return 'var(--z2)';
  if (t.includes('strength') || t.includes('weight') || t.includes('gym') || t.includes('lift')) return 'var(--z4)';
  if (t.includes('walk') || t.includes('hike')) return 'var(--z3)';
  return 'var(--text-dim)';
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((cell, idx) => {
          if (!cell.iso) {
            return <div key={`empty-${idx}`} style={{ minHeight: 52 }} />;
          }
          const iso = cell.iso;
          const isToday = iso === todayIso;
          const isSelected = iso === selectedDate;
          const isHighlight = iso === highlightDate;
          const events = eventsByDate[iso] ?? [];
          const displayEvents = events.slice(0, 2);
          const overflow = events.length - displayEvents.length;

          return (
            <button
              key={iso}
              ref={el => onCellRef?.(iso, el)}
              data-date={iso}
              onClick={() => onSelectDay(iso)}
              style={{
                background: isSelected ? 'var(--surface-2)' : isHighlight ? 'rgba(240,165,0,0.15)' : 'transparent',
                border: isHighlight ? '2px solid var(--accent)' : '1px solid transparent',
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
                  color: isToday ? 'var(--bg)' : isSelected ? 'var(--accent)' : 'var(--text)',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  border: isToday ? 'none' : isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  flexShrink: 0,
                }}
              >
                {cell.day}
              </span>

              {/* Event glyphs */}
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
                      <SportGlyph type={ev.type} size={14} color={sportColor(ev.type)} />
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1 }}>+{overflow}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
