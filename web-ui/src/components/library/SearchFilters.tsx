import { useState } from 'react';
import FilterChip from './FilterChip';

const ZONE_OPTIONS = [
  { label: 'Endurance', value: 'endurance', color: 'var(--z2)' },
  { label: 'Tempo', value: 'tempo', color: 'var(--z3)' },
  { label: 'Sweet Spot', value: 'sweet_spot', color: 'var(--z4)' },
  { label: 'Threshold', value: 'threshold', color: 'var(--z5)' },
  { label: 'VO2max', value: 'vo2max', color: 'var(--z6)' },
  { label: 'Anaerobic', value: 'anaerobic', color: 'var(--z7)' },
];

const DURATION_OPTIONS = [
  { label: '45m', value: 45 * 60 },
  { label: '60m', value: 60 * 60 },
  { label: '90m', value: 90 * 60 },
];

const TSS_OPTIONS = [
  { label: '<50 TSS', value: 50 },
  { label: '<70 TSS', value: 70 },
  { label: '<100 TSS', value: 100 },
];

export interface SearchFiltersProps {
  nameSearch: string;
  onNameSearch: (v: string) => void;
  zoneFilter: string[];
  onZoneToggle: (z: string) => void;
  durationMax?: number;
  onDurationMax: (v: number | undefined) => void;
  tssMax?: number;
  onTssMax: (v: number | undefined) => void;
}

export default function SearchFilters({
  nameSearch,
  onNameSearch,
  zoneFilter,
  onZoneToggle,
  durationMax,
  onDurationMax,
  tssMax,
  onTssMax,
}: SearchFiltersProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      {/* Search input */}
      <input
        type="search"
        placeholder="Search workouts…"
        value={nameSearch}
        onChange={e => onNameSearch(e.target.value)}
        aria-label="Search workouts"
        style={{
          width: '100%',
          minHeight: 44,
          padding: '0 var(--sp-3)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: 15,
          fontFamily: 'var(--font)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Zone chips */}
      <div
        role="group"
        aria-label="Filter by zone"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)' }}
      >
        {ZONE_OPTIONS.map(z => (
          <FilterChip
            key={z.value}
            label={z.label}
            active={zoneFilter.includes(z.value)}
            color={z.color}
            onToggle={() => onZoneToggle(z.value)}
          />
        ))}
      </div>

      {/* More filters toggle */}
      <button
        type="button"
        onClick={() => setShowMore(v => !v)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          fontFamily: 'var(--font)',
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
          minHeight: 44,
        }}
      >
        {showMore ? '▲ Fewer filters' : '▼ More filters'}
      </button>

      {showMore && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {/* Duration max */}
          <div>
            <label
              htmlFor="duration-max"
              style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 'var(--sp-1)' }}
            >
              Max duration
            </label>
            <select
              id="duration-max"
              value={durationMax ?? ''}
              onChange={e => onDurationMax(e.target.value ? Number(e.target.value) : undefined)}
              style={{
                minHeight: 44,
                padding: '0 var(--sp-3)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontFamily: 'var(--font)',
                cursor: 'pointer',
              }}
            >
              <option value="">Any</option>
              {DURATION_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* TSS max chips */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 'var(--sp-1)' }}>
              Max TSS
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
              {TSS_OPTIONS.map(t => (
                <FilterChip
                  key={t.value}
                  label={t.label}
                  active={tssMax === t.value}
                  onToggle={() => onTssMax(tssMax === t.value ? undefined : t.value)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
