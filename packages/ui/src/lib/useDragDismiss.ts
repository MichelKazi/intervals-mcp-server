import { useCallback, useRef, useState } from 'react';

export interface DragDismissOptions {
  /** Called when the sheet is dragged past the dismiss threshold and released. */
  onDismiss: () => void;
  /** Drag distance (px) past which release dismisses. Default 120. */
  threshold?: number;
}

export interface DragDismissState {
  /** Live downward offset in px (0 when not dragging). Apply as translateY. */
  offsetY: number;
  /** True while a drag is in progress (disable transition for 1:1 tracking). */
  dragging: boolean;
  /** Spread onto the drag handle (or the sheet) to start a drag. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
}

/**
 * Drag-to-dismiss for bottom sheets. Tracks a downward pointer drag, exposes a
 * live offset to translate the sheet, and calls onDismiss when released past the
 * threshold. Upward drag is clamped to 0 (sheets don't pull up past the top).
 *
 * Pointer-events based so it works for touch and mouse. Attach `handlers` to the
 * drag handle for a grab-the-handle feel, or to the whole sheet header.
 */
export function useDragDismiss({ onDismiss, threshold = 120 }: DragDismissOptions): DragDismissState {
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const activeId = useRef<number | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (activeId.current === null) return;
    const dy = e.clientY - startY.current;
    setOffsetY(dy > 0 ? dy : 0); // clamp upward drag
  }, []);

  const end = useCallback(() => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    activeId.current = null;
    setDragging(false);
    setOffsetY((current) => {
      if (current >= threshold) {
        // release the state update, then dismiss on the next tick
        queueMicrotask(onDismiss);
      }
      return 0; // snap back; if dismissing, the unmount handles the rest
    });
  }, [onPointerMove, onDismiss, threshold]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      activeId.current = e.pointerId;
      startY.current = e.clientY;
      setDragging(true);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    [onPointerMove, end],
  );

  return { offsetY, dragging, handlers: { onPointerDown } };
}
