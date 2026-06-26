import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import SearchFilters from '../components/library/SearchFilters';
import ResultList from '../components/library/ResultList';
import WorkoutPreviewSheet from '../components/library/WorkoutPreviewSheet';
import CustomWorkoutForm from '../components/library/CustomWorkoutForm';
import { searchLibrary } from '../lib/api';
import type { LibraryWorkout } from '../lib/types';

export default function LibraryAdd() {
  const [nameSearch, setNameSearch] = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [durationMax, setDurationMax] = useState<number | undefined>();
  const [tssMax, setTssMax] = useState<number | undefined>();
  const [selectedWorkout, setSelectedWorkout] = useState<LibraryWorkout | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [scheduledBanner, setScheduledBanner] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedName(nameSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nameSearch]);

  const queryParams: Record<string, string | number | boolean> = {};
  if (debouncedName) queryParams.name = debouncedName;
  if (zoneFilter.length > 0) queryParams.zone_focus = zoneFilter.join(',');
  if (durationMax) queryParams.duration_max = durationMax;
  if (tssMax) queryParams.tss_max = tssMax;

  const { data: workouts = [], isFetching } = useQuery({
    queryKey: ['library', debouncedName, zoneFilter.join(','), durationMax, tssMax],
    queryFn: () => searchLibrary(queryParams),
    staleTime: 30_000,
  });

  function handleZoneToggle(z: string) {
    setZoneFilter(prev =>
      prev.includes(z) ? prev.filter(v => v !== z) : [...prev, z]
    );
  }

  function handleScheduled() {
    setSelectedWorkout(null);
    setScheduledBanner(true);
    setTimeout(() => setScheduledBanner(false), 3000);
  }

  return (
    <AppShell title="Library">
      {/* Scheduled banner */}
      {scheduledBanner && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 'calc(64px + env(safe-area-inset-top))',
            left: 'var(--sp-4)',
            right: 'var(--sp-4)',
            background: 'var(--z2)',
            color: '#fff',
            padding: 'var(--sp-3) var(--sp-4)',
            borderRadius: 'var(--radius)',
            zIndex: 150,
            fontWeight: 600,
            fontSize: 14,
            textAlign: 'center',
            boxShadow: 'var(--shadow-2)',
          }}
        >
          Scheduled!
        </div>
      )}

      <div style={{ padding: 'var(--sp-4)' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-3)' }}>
          <button
            type="button"
            onClick={() => setShowCustomForm(true)}
            style={{
              minHeight: 44,
              padding: '0 var(--sp-4)',
              background: 'var(--surface-2)',
              color: 'var(--accent)',
              border: `1px solid var(--accent)`,
              borderRadius: 'var(--radius)',
              fontSize: 14,
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Build custom
          </button>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <SearchFilters
            nameSearch={nameSearch}
            onNameSearch={setNameSearch}
            zoneFilter={zoneFilter}
            onZoneToggle={handleZoneToggle}
            durationMax={durationMax}
            onDurationMax={setDurationMax}
            tssMax={tssMax}
            onTssMax={setTssMax}
          />
        </div>

        {/* Results */}
        <ResultList
          workouts={workouts}
          isLoading={isFetching}
          onSelect={setSelectedWorkout}
        />
      </div>

      {/* Preview sheet */}
      <WorkoutPreviewSheet
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        onScheduled={handleScheduled}
      />

      {/* Custom form */}
      {showCustomForm && (
        <CustomWorkoutForm
          onClose={() => setShowCustomForm(false)}
          onCreated={() => setShowCustomForm(false)}
        />
      )}
    </AppShell>
  );
}
