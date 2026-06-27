import { describe, it, expect } from 'vitest';
import { buildPlanSkeleton, INJECTION_WEEKDAY, MESO_TOTAL_WEEKS } from './plan';
import { reconcilePlan } from './reconcile';

const NOW = new Date('2026-06-29T12:00:00'); // a Monday

describe('buildPlanSkeleton', () => {
  it('places hard days on the chosen weekdays', () => {
    const s = buildPlanSkeleton({ hardWeekdays: [1, 4], weeks: 2, now: NOW }); // Tue, Fri
    const wk1 = s.weeks[0];
    expect(wk1.days.filter((d) => d.type === 'hard').map((d) => d.weekday)).toEqual([1, 4]);
  });

  it('refuses Thursday and flags the conflict', () => {
    const s = buildPlanSkeleton({ hardWeekdays: [INJECTION_WEEKDAY, 1], weeks: 1, now: NOW });
    expect(s.injectionConflict).toBe(true);
    expect(s.hardWeekdays).not.toContain(INJECTION_WEEKDAY);
    const thu = s.weeks[0].days[INJECTION_WEEKDAY];
    expect(thu.type).not.toBe('hard');
  });

  it('warns on back-to-back hard days', () => {
    const s = buildPlanSkeleton({ hardWeekdays: [1, 2], weeks: 1, now: NOW }); // Tue+Wed
    expect(s.spacingWarnings.length).toBeGreaterThan(0);
  });

  it('makes every 3rd week a recovery week with no hard days', () => {
    const s = buildPlanSkeleton({ hardWeekdays: [1, 4], weeks: MESO_TOTAL_WEEKS, now: NOW });
    const recovery = s.weeks[MESO_TOTAL_WEEKS - 1];
    expect(recovery.isRecoveryWeek).toBe(true);
    expect(recovery.days.some((d) => d.type === 'hard')).toBe(false);
  });

  it('counts total hard sessions excluding recovery weeks', () => {
    const s = buildPlanSkeleton({ hardWeekdays: [1, 4], weeks: 3, now: NOW });
    // weeks 1-2 build = 2 hard each, week 3 recovery = 0
    expect(s.totalHardSessions).toBe(4);
  });
});

describe('reconcilePlan', () => {
  const skeleton = buildPlanSkeleton({ hardWeekdays: [1, 4], weeks: 4, now: new Date('2026-06-01T12:00:00') });

  it('flags a missed streak as recovery', () => {
    const adj = reconcilePlan({
      skeleton,
      completedDates: [],
      now: new Date('2026-06-15T12:00:00'),
    });
    expect(adj.some((a) => a.kind === 'missed_days_recovery')).toBe(true);
  });

  it('recommends an easy day when readiness is red', () => {
    const adj = reconcilePlan({
      skeleton,
      completedDates: skeleton.weeks.flatMap((w) => w.days).map((d) => d.date),
      readiness: 'red',
      now: new Date('2026-06-08T12:00:00'),
    });
    expect(adj.some((a) => a.kind === 'overreaching')).toBe(true);
  });

  it('reports on-track when sessions match and form is fine', () => {
    const allDates = skeleton.weeks.flatMap((w) => w.days).map((d) => d.date);
    const adj = reconcilePlan({
      skeleton,
      completedDates: allDates,
      readiness: 'green',
      tsb: 0,
      now: new Date('2026-07-15T12:00:00'),
    });
    expect(adj).toHaveLength(1);
    expect(adj[0].kind).toBe('on_track');
  });
});
