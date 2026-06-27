import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPressDrag } from './useLongPressDrag';

// jsdom doesn't implement setPointerCapture, so stub it
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function makePointerEvent(type: string, overrides: Partial<PointerEventInit & { clientX: number; clientY: number }> = {}): PointerEvent {
  const ev = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: 'touch',
    clientX: overrides.clientX ?? 100,
    clientY: overrides.clientY ?? 100,
    button: 0,
    ...overrides,
  });
  return ev;
}

function makeReactPointerEvent(overrides: Partial<{ clientX: number; clientY: number; pointerId: number }> = {}): React.PointerEvent {
  const nativeEvent = makePointerEvent('pointerdown', overrides);
  const mockTarget = {
    setPointerCapture: vi.fn(),
  } as unknown as EventTarget;
  return {
    nativeEvent,
    pointerId: overrides.pointerId ?? 1,
    pointerType: 'touch',
    clientX: overrides.clientX ?? 100,
    clientY: overrides.clientY ?? 100,
    button: 0,
    currentTarget: mockTarget,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent;
}

describe('useLongPressDrag', () => {
  it('(e1) long press + move to different day fires onMove with correct (id, date)', async () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onTap = vi.fn();
    const dateFromPoint = vi.fn((x: number) => (x > 200 ? '2026-06-28' : '2026-06-26'));

    const { result } = renderHook(() =>
      useLongPressDrag({ onMove, onTap, dateFromPoint }),
    );

    const reactEvent = makeReactPointerEvent({ clientX: 100, clientY: 100 });

    // Start long press
    act(() => {
      result.current.onPointerDown(reactEvent, 42, '2026-06-26');
    });

    // Advance past the 500ms threshold
    act(() => {
      vi.advanceTimersByTime(510);
    });

    // Simulate pointermove to a different day
    const moveEvent = makePointerEvent('pointermove', { clientX: 250, clientY: 100 });
    act(() => {
      document.dispatchEvent(moveEvent);
    });

    // Simulate pointerup on new day
    const upEvent = makePointerEvent('pointerup', { clientX: 250, clientY: 100 });
    act(() => {
      document.dispatchEvent(upEvent);
    });

    expect(onMove).toHaveBeenCalledWith(42, '2026-06-28');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('(e2) short tap (pointerup before 500ms) does NOT fire onMove, fires onTap', () => {
    const onMove = vi.fn();
    const onTap = vi.fn();
    const dateFromPoint = vi.fn(() => '2026-06-28');

    const { result } = renderHook(() =>
      useLongPressDrag({ onMove, onTap, dateFromPoint }),
    );

    const reactEvent = makeReactPointerEvent({ clientX: 100, clientY: 100 });

    act(() => {
      result.current.onPointerDown(reactEvent, 42, '2026-06-26');
    });

    // Only advance 200ms — not enough for long press
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Simulate pointerup before 500ms
    const upEvent = makePointerEvent('pointerup', { clientX: 105, clientY: 100 });
    act(() => {
      document.dispatchEvent(upEvent);
    });

    expect(onMove).not.toHaveBeenCalled();
    expect(onTap).toHaveBeenCalledWith(42);
  });

  it('fires onDragStart when long press activates', () => {
    const onMove = vi.fn().mockResolvedValue(undefined);
    const onDragStart = vi.fn();
    const dateFromPoint = vi.fn(() => '2026-06-26');

    const { result } = renderHook(() =>
      useLongPressDrag({ onMove, onDragStart, dateFromPoint }),
    );

    const reactEvent = makeReactPointerEvent();

    act(() => {
      result.current.onPointerDown(reactEvent, 99, '2026-06-26');
    });

    act(() => {
      vi.advanceTimersByTime(510);
    });

    expect(onDragStart).toHaveBeenCalledWith(99);
  });

  it('does not fire onMove when released on same day', async () => {
    const onMove = vi.fn();
    const dateFromPoint = vi.fn(() => '2026-06-26'); // same day

    const { result } = renderHook(() =>
      useLongPressDrag({ onMove, dateFromPoint }),
    );

    act(() => {
      result.current.onPointerDown(makeReactPointerEvent(), 10, '2026-06-26');
    });

    act(() => {
      vi.advanceTimersByTime(510);
    });

    const upEvent = makePointerEvent('pointerup', { clientX: 100, clientY: 100 });
    act(() => {
      document.dispatchEvent(upEvent);
    });

    expect(onMove).not.toHaveBeenCalled();
  });
});
