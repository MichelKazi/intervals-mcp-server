import { useRef, useCallback, useEffect } from 'react';

export interface DragCallbacks {
  /** Called when a long-press drag is committed to a new date. */
  onMove: (eventId: string | number, newDate: string) => void;
  /** Called on a plain tap (no long-press). */
  onTap?: (eventId: string | number) => void;
  /** Called when drag starts — returns cleanup fn. */
  onDragStart?: (eventId: string | number) => void;
  /** Called when drag ends (committed or cancelled). */
  onDragEnd?: () => void;
  /** Given a pointer position, return the ISO date string for that day cell (or null). */
  dateFromPoint: (x: number, y: number) => string | null;
}

export interface LongPressDragHandlers {
  onPointerDown: (e: React.PointerEvent, eventId: string | number, originDate: string) => void;
}

const LONG_PRESS_MS = 500;
const CANCEL_MOVE_PX = 8; // movement before long-press timer; cancel on early move

/**
 * Encapsulates the long-press-to-drag interaction for calendar event rescheduling.
 *
 * - Short tap (pointer up before 500 ms, or move < 8px before 500 ms): fires onTap.
 * - Long press (500 ms held without significant movement): activates drag mode.
 *   Subsequent pointermove tracks the target day. Pointerup commits if over a different day.
 */
export function useLongPressDrag({ onMove, onTap, onDragStart, onDragEnd, dateFromPoint }: DragCallbacks): LongPressDragHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const eventIdRef = useRef<string | number>('');
  const originDateRef = useRef<string>('');
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    draggingRef.current = false;
    startPosRef.current = null;
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!draggingRef.current) {
        // Still in long-press window — cancel on significant movement
        if (dist > CANCEL_MOVE_PX) {
          cleanup();
          // Not a drag, let normal scroll happen
        }
        return;
      }

      // In drag mode — highlight day under pointer
      const date = dateFromPoint(e.clientX, e.clientY);
      document.dispatchEvent(new CustomEvent('calendar:drag-over', { detail: { date } }));
    },
    [cleanup, dateFromPoint],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const wasDragging = draggingRef.current;

      if (!wasDragging) {
        // Short tap or cancelled press
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          onTap?.(eventIdRef.current);
        }
      } else {
        const date = dateFromPoint(e.clientX, e.clientY);
        if (date && date !== originDateRef.current) {
          onMove(eventIdRef.current, date);
        }
        onDragEnd?.();
      }

      // Clear drag highlight
      document.dispatchEvent(new CustomEvent('calendar:drag-over', { detail: { date: null } }));
      cleanup();
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    },
    [cleanup, dateFromPoint, onDragEnd, onMove, onTap, handlePointerMove],
  );

  // Unmount cleanup: clear pending timer and remove document listeners left over
  // if the component unmounts mid-gesture (e.g. navigation during a long-press).
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      draggingRef.current = false;
      startPosRef.current = null;
    };
  }, [handlePointerMove, handlePointerUp]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, eventId: string | number, originDate: string) => {
      // Only primary button / touch
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      e.currentTarget.setPointerCapture(e.pointerId);
      eventIdRef.current = eventId;
      originDateRef.current = originDate;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;

      document.addEventListener('pointermove', handlePointerMove, { passive: true });
      document.addEventListener('pointerup', handlePointerUp, { once: true });

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        draggingRef.current = true;
        onDragStart?.(eventId);
        document.dispatchEvent(new CustomEvent('calendar:drag-start', { detail: { eventId, date: originDate } }));
      }, LONG_PRESS_MS);
    },
    [handlePointerMove, handlePointerUp, onDragStart],
  );

  return { onPointerDown };
}
