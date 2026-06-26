import { useNavigate } from 'react-router-dom';
import type { PlannedEvent } from '../../lib/types';
import { formatDuration, formatDate } from '../../lib/format';
import SportGlyph from './SportGlyph';

interface DayAgendaProps {
  date: string | null;
  events: PlannedEvent[];
  onEventLongPress?: (e: React.PointerEvent, event: PlannedEvent, date: string) => void;
  draggingId?: string | number | null;
}

function sportColor(type: string): string {
  const t = (type ?? '').toLowerCase();
  if (t.includes('ride') || t.includes('bike') || t.includes('cycling') || t.includes('virtual') || t.includes('ebike')) return 'var(--z5)';
  if (t.includes('run') || t.includes('jog') || t.includes('trail')) return 'var(--z6)';
  if (t.includes('swim') || t.includes('pool') || t.includes('open_water')) return 'var(--z2)';
  if (t.includes('strength') || t.includes('weight') || t.includes('gym') || t.includes('lift')) return 'var(--z4)';
  if (t.includes('walk') || t.includes('hike')) return 'var(--z3)';
  return 'var(--text-dim)';
}

function isDone(ev: PlannedEvent): boolean {
  return ev.category === 'ACTIVITY' || ev.category === 'DONE';
}

export default function DayAgenda({ date, events, onEventLongPress, draggingId }: DayAgendaProps) {
  const navigate = useNavigate();

  if (!date) {
    return (
      <div style={{ padding: 'var(--sp-4)', color: 'var(--text-dim)', textAlign: 'center', fontSize: 14 }}>
        Tap a day to see workouts
      </div>
    );
  }

  const label = formatDate(date + 'T00:00:00');

  return (
    <div>
      <div
        style={{
          padding: 'var(--sp-3) var(--sp-4)',
          color: 'var(--text-dim)',
          fontSize: 13,
          fontWeight: 600,
          borderBottom: '1px solid var(--border)',
        }}
      >
        {label}
      </div>

      {events.length === 0 ? (
        <div style={{ padding: 'var(--sp-4)', color: 'var(--text-dim)', fontSize: 14 }}>
          No workouts planned
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} role="list">
          {events.map(ev => {
            const done = isDone(ev);
            const color = sportColor(ev.type);
            const isBeingDragged = draggingId != null && String(ev.id) === String(draggingId);

            return (
              <li
                key={ev.id}
                data-testid="agenda-event-row"
                data-event-id={ev.id}
              >
                <button
                  onClick={() => navigate(`/workout/${ev.id}`)}
                  onPointerDown={e => {
                    if (date) onEventLongPress?.(e, ev, date);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    width: '100%',
                    background: isBeingDragged ? 'var(--surface-2)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: 'var(--sp-3) var(--sp-4)',
                    cursor: 'pointer',
                    color: 'var(--text)',
                    textAlign: 'left',
                    minHeight: 56,
                    transform: isBeingDragged ? 'scale(1.03)' : 'scale(1)',
                    boxShadow: isBeingDragged ? 'var(--shadow-3)' : 'none',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    touchAction: 'none',
                  }}
                  aria-label={`${ev.name} — ${done ? 'completed' : 'planned'}`}
                >
                  {/* Sport glyph */}
                  <span style={{ flexShrink: 0, lineHeight: 0 }}>
                    <SportGlyph
                      type={ev.type}
                      size={22}
                      color={color}
                      data-testid="sport-glyph"
                    />
                  </span>

                  {/* Name + meta */}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: done ? 0.6 : 1,
                      }}
                    >
                      {ev.name}
                    </span>
                    <span style={{ display: 'flex', gap: 'var(--sp-2)', fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                      {ev.moving_time != null && (
                        <span>{formatDuration(ev.moving_time)}</span>
                      )}
                      {ev.icu_training_load != null && (
                        <span>{Math.round(ev.icu_training_load)} TSS</span>
                      )}
                    </span>
                  </span>

                  {/* Done / planned badge */}
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: done ? 'rgba(82,199,127,0.15)' : 'rgba(240,165,0,0.12)',
                      color: done ? 'var(--z2)' : 'var(--brand)',
                    }}
                  >
                    {done ? '✓ done' : 'planned'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
