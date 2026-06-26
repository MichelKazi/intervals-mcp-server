import { useState } from 'react';
import FilterChip from './FilterChip';
import { Input } from '../ui/input';

// Zone colors aligned with ZONE_COLORS in zoneColors.ts:
// endurance=zone-1 (#3b82f6), tempo=zone-2 (#eab308), sweet_spot/threshold=zone-3 (#f97316),
// vo2max=zone-4 (#ef4444), anaerobic=zone-5 (#a855f7)
const ZONE_OPTIONS = [
  { label: 'Endurance', value: 'endurance', color: '#3b82f6' },
  { label: 'Tempo', value: 'tempo', color: '#eab308' },
  { label: 'Sweet Spot', value: 'sweet_spot', color: '#f97316' },
  { label: 'Threshold', value: 'threshold', color: '#f97316' },
  { label: 'VO2max', value: 'vo2max', color: '#ef4444' },
  { label: 'Anaerobic', value: 'anaerobic', color: '#a855f7' },
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
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <Input
        type="search"
        placeholder="Search workouts…"
        value={nameSearch}
        onChange={e => onNameSearch(e.target.value)}
        aria-label="Search workouts"
        className="min-h-[44px] text-[15px]"
      />

      {/* Zone chips */}
      <div role="group" aria-label="Filter by zone" className="flex flex-wrap gap-2">
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
        className="min-h-[44px] cursor-pointer border-none bg-transparent p-0 text-left text-[13px] text-primary"
      >
        {showMore ? '▲ Fewer filters' : '▼ More filters'}
      </button>

      {showMore && (
        <div className="flex flex-col gap-3">
          {/* Duration max */}
          <div>
            <label htmlFor="duration-max" className="mb-1 block text-xs text-muted-foreground">
              Max duration
            </label>
            <select
              id="duration-max"
              value={durationMax ?? ''}
              onChange={e => onDurationMax(e.target.value ? Number(e.target.value) : undefined)}
              className="min-h-[44px] cursor-pointer rounded-md border border-input bg-muted px-3 text-sm text-foreground"
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
            <div className="mb-1 text-xs text-muted-foreground">Max TSS</div>
            <div className="flex flex-wrap gap-2">
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
