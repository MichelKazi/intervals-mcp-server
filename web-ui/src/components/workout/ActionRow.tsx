import { useState } from 'react';
import { markEventDone, moveEvent } from '../../lib/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ActionRowProps {
  eventId: string | number;
  onDone?: () => void;
  onMoved?: () => void;
  onFindAlternatives?: () => void;
  onEditClick?: () => void;
}

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
    <div className="mx-4 mb-4">
      <div className="flex flex-wrap gap-2">
        <Button
          data-testid="mark-done-btn"
          variant="outline"
          size="touch"
          className="flex-1 border-[color:var(--brand-dim)] text-primary"
          onClick={handleMarkDone}
          disabled={marking}
          aria-busy={marking}
        >
          {marking ? '…' : '✓ Mark done'}
        </Button>

        <Button
          data-testid="reschedule-btn"
          variant="outline"
          size="touch"
          className="flex-1 bg-card"
          onClick={() => setShowReschedule((s) => !s)}
        >
          Reschedule
        </Button>

        <Button
          data-testid="alternatives-btn"
          variant="outline"
          size="touch"
          className="flex-1 bg-card"
          onClick={onFindAlternatives}
        >
          Alternatives
        </Button>

        <Button
          data-testid="edit-btn"
          variant="outline"
          size="touch"
          className="flex-1 bg-card"
          onClick={onEditClick}
        >
          Edit
        </Button>
      </div>

      {showReschedule && (
        <div className="mt-3">
          <label htmlFor="reschedule-date" className="mb-1 block text-[13px] text-muted-foreground">
            New date
          </label>
          <Input
            id="reschedule-date"
            data-testid="reschedule-date-input"
            type="date"
            disabled={rescheduling}
            onChange={handleReschedule}
            className="min-h-[44px] w-full text-[15px] [color-scheme:dark]"
          />
        </div>
      )}
    </div>
  );
}
