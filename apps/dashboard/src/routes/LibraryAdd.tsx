import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from '../components/AppShell';
import SearchFilters from '../components/library/SearchFilters';
import ResultList from '../components/library/ResultList';
import WorkoutPreviewSheet from '../components/library/WorkoutPreviewSheet';
import CustomWorkoutForm from '../components/library/CustomWorkoutForm';
import { Button } from '../components/ui/button';
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
  if (debouncedName) queryParams.name_search = debouncedName;
  if (zoneFilter.length > 0) queryParams.zone_focus = zoneFilter.join(',');
  // Backend expects duration_max_minutes; SearchFilters stores seconds.
  if (durationMax) queryParams.duration_max_minutes = Math.round(durationMax / 60);
  if (tssMax) queryParams.tss_max = tssMax;

  const { data: workouts = [], isFetching, isError, error, refetch } = useQuery({
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
          className="fixed inset-x-4 z-[150] rounded-md px-4 py-3 text-center text-sm font-semibold text-white shadow-lg"
          style={{
            top: 'calc(64px + env(safe-area-inset-top))',
            background: 'var(--z2)',
          }}
        >
          Scheduled!
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Library</h1>
          <Button
            type="button"
            onClick={() => setShowCustomForm(true)}
            size="touch"
            className="rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:bg-primary/90"
          >
            + Build
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4">
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
        {isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 p-4 text-destructive">
            <span>
              {error instanceof Error ? error.message : 'Could not load workouts. Check your connection.'}
            </span>
            <Button type="button" onClick={() => refetch()} variant="outline" size="touch">
              Retry
            </Button>
          </div>
        ) : (
          <ResultList
            workouts={workouts}
            isLoading={isFetching}
            onSelect={setSelectedWorkout}
          />
        )}
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
