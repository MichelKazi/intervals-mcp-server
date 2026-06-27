import { describe, it, expect } from 'vitest';
import { preComputeGoal, type FTPGoalInput } from './compute';
import { MICHEL } from './constants';

const NOW = new Date('2026-06-26T12:00:00');

function daysFromNow(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const weeksFromNow = (w: number) => daysFromNow(w * 7);

const BASE: FTPGoalInput = {
  currentFtp: 290,
  targetFtp: 295,
  targetDate: weeksFromNow(12),
  currentCtl: 48,
  weightKg: 83,
  now: NOW,
};

describe('preComputeGoal — deterministic validation', () => {
  describe('hard limits (percentage-based, per FTP_GOAL_SCIENCE.md)', () => {
    it('rejects a large gain in 5 days', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 340, targetDate: daysFromNow(5) });
      expect(r.isPhysicallyPossible).toBe(false);
      // 5 days is below the 14-day minimum, and the gain blows the ceiling.
      expect(r.tooShortDuration).toBe(true);
    });

    it('rejects a gain above the hard ceiling for a 12-week window', () => {
      // 12wk hard limit = 15% of 290 = ~43W. Returning multiplier 1.5x only
      // applies up to peak (363). Target 290+60=350 <=363 so returning band
      // applies: hard ~65W. 70W exceeds even that.
      const r = preComputeGoal({ ...BASE, targetFtp: 360, targetDate: weeksFromNow(12) });
      expect(r.exceedsHardLimit).toBe(true);
      expect(r.isPhysicallyPossible).toBe(false);
    });

    it('allows a returning-athlete gain toward the documented peak', () => {
      // 8wk trained hard = 10% of 290 = 29W. Returning 1.5x = ~44W.
      // Target 290+40=330 <=363, gain 40W < 44W ceiling → possible.
      const r = preComputeGoal({ ...BASE, targetFtp: 330, targetDate: weeksFromNow(8) });
      expect(r.isReturningTowardPeak).toBe(true);
      expect(r.exceedsHardLimit).toBe(false);
    });

    it('same gain past peak is rejected as exceeding all-time peak', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 400, targetDate: weeksFromNow(20) });
      expect(r.exceedsAllTimePeak).toBe(true);
      expect(r.isPhysicallyPossible).toBe(false);
    });
  });

  describe('achievability scoring (% of FTP per week)', () => {
    it('scores conservative for a tiny gain over a long window', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 295, targetDate: weeksFromNow(12) });
      expect(r.achievability).toBe('conservative');
      expect(r.baseConfidence).toBeGreaterThanOrEqual(90);
    });

    it('scores unrealistic for a fast required rate', () => {
      // 290→315 in 4wk = 8.6% over 4wk = ~2.2%/wk > 1.5% suspect ceiling.
      const r = preComputeGoal({ ...BASE, targetFtp: 315, targetDate: weeksFromNow(4) });
      expect(r.achievability).toBe('unrealistic');
    });
  });

  describe('CTL prerequisites', () => {
    it('flags insufficient CTL for an ambitious target', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 340, currentCtl: 48 });
      expect(r.ctlSufficient).toBe(false);
      expect(r.minCtlRequired).toBeGreaterThan(48);
      expect(r.weeksToRequiredCtl).toBeGreaterThan(0);
    });
  });

  describe('peak handling', () => {
    it('flags a target above the all-time peak', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 370, targetDate: weeksFromNow(52) });
      expect(r.exceedsAllTimePeak).toBe(true);
      expect(r.isPhysicallyPossible).toBe(false);
      expect(r.validationMessage).toContain(String(MICHEL.ALL_TIME_PEAK_FTP));
    });
  });

  describe('below-current and too-short', () => {
    it('flags a target at or below current FTP', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 285 });
      expect(r.belowCurrentFtp).toBe(true);
      expect(r.isPhysicallyPossible).toBe(false);
    });

    it('flags a target date under 14 days out', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 293, targetDate: daysFromNow(10) });
      expect(r.tooShortDuration).toBe(true);
      expect(r.isPhysicallyPossible).toBe(false);
    });
  });

  describe('plan template selection', () => {
    it('selects 4w for short timelines', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 295, targetDate: weeksFromNow(4) });
      expect(r.planTemplateKey).toBe('4w');
    });
    it('selects 20w for long timelines', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 320, targetDate: weeksFromNow(24) });
      expect(r.planTemplateKey).toBe('20w');
    });
  });

  describe('messages are concrete and LLM-free', () => {
    it('rejection message names watts and weeks', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 360, targetDate: weeksFromNow(12) });
      expect(r.validationMessage).toMatch(/W/);
      expect(r.validationMessage.length).toBeGreaterThan(20);
    });
    it('returning advantage note appears for a valid sub-peak return', () => {
      const r = preComputeGoal({ ...BASE, targetFtp: 320, targetDate: weeksFromNow(16) });
      expect(r.returningAdvantageNote).not.toBeNull();
    });
  });
});
