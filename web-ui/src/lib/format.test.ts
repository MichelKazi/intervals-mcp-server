import { describe, it, expect } from 'vitest';
import { formatDuration, zoneName } from './format';

describe('formatDuration', () => {
  it('3660s → 1h01m', () => expect(formatDuration(3660)).toBe('1h01m'));
  it('4080s → 1h08m', () => expect(formatDuration(4080)).toBe('1h08m'));
  it('2700s → 45m', () => expect(formatDuration(2700)).toBe('45m'));
});

describe('zoneName', () => {
  it('50 → recovery', () => expect(zoneName(50)).toBe('recovery'));
  it('60 → endurance', () => expect(zoneName(60)).toBe('endurance'));
  it('80 → tempo', () => expect(zoneName(80)).toBe('tempo'));
  it('90 → sweet spot', () => expect(zoneName(90)).toBe('sweet spot'));
  it('100 → threshold', () => expect(zoneName(100)).toBe('threshold'));
  it('110 → vo2max', () => expect(zoneName(110)).toBe('vo2max'));
  it('130 → anaerobic', () => expect(zoneName(130)).toBe('anaerobic'));
});
