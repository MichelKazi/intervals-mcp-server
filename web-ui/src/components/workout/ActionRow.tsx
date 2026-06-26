import { useState } from 'react';
import { markEventDone, moveEvent } from '../../lib/api';

interface ActionRowProps {
  eventId: string | number;
  onDone?: () => void;
  onMoved?: () => void;
  onFindAlternatives?: () => void;
  onEditClick?: () => void;
}

const btnStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  minWidth: 44,
  padding: 'var(--sp-2) var(--sp-3)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--sp-1)',
  fontFamily: 'var(--font)',
};

export default function ActionRow({
  eventId,
  onDone,
  onMoved,
  onFindAlternatives,
  onEditClick,
}: ActionRowProps) {
  const [marking, setMarking] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  async function handleMarkDone() {
    setMarking(true);
    try {
      await markEventDone(eventId);
      onDone?.();
    } finally {
      setMarking(false);
    }
  }

  async function handleReschedule(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    if (!newDate) return;
    setRescheduling(true);
    try {
      await moveEvent(eventId, newDate);
      setShowReschedule(false);
      onMoved?.();
    } finally {
      setRescheduling(false);
    }
  }

  return (
    <div style={{ margin: '0 var(--sp-4) var(--sp-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        <button
          data-testid="mark-done-btn"
          style={{ ...btnStyle, color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}
          onClick={handleMarkDone}
          disabled={marking}
          aria-busy={marking}
        >
          {marking ? '…' : '✓ Mark done'}
        </button>

        <button
          data-testid="reschedule-btn"
          style={btnStyle}
          onClick={() => setShowReschedule((s) => !s)}
        >
          Reschedule
        </button>

        <button
          data-testid="alternatives-btn"
          style={btnStyle}
          onClick={onFindAlternatives}
        >
          Alternatives
        </button>

        <button
          data-testid="edit-btn"
          style={btnStyle}
          onClick={onEditClick}
        >
          Edit
        </button>
      </div>

      {showReschedule && (
        <div style={{ marginTop: 'var(--sp-3)' }}>
          <label
            htmlFor="reschedule-date"
            style={{ fontSize: 13, color: 'var(--text-dim)', display: 'block', marginBottom: 'var(--sp-1)' }}
          >
            New date
          </label>
          <input
            id="reschedule-date"
            data-testid="reschedule-date-input"
            type="date"
            disabled={rescheduling}
            onChange={handleReschedule}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              padding: 'var(--sp-2) var(--sp-3)',
              fontSize: 15,
              minHeight: 44,
              width: '100%',
              boxSizing: 'border-box',
              colorScheme: 'dark',
              fontFamily: 'var(--font)',
            }}
          />
        </div>
      )}
    </div>
  );
}
