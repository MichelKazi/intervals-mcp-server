import { Hammer } from 'lucide-react';

import AppShell from '@/components/AppShell';

export default function WorkoutBuilder() {
  return (
    <AppShell title="Workout Builder" showBack>
      <div className="px-4 pb-20 pt-4">
        <section className="flex flex-col items-center gap-4 rounded-xl border border-border-default bg-bg-surface p-8 text-center opacity-80">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-raised">
            <Hammer size={26} className="text-slate-500" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-100">Coming Soon</h2>
            <p className="mt-1 text-[12px] uppercase tracking-widest text-accent">Phase 2</p>
          </div>
          <p className="max-w-xs text-[13px] leading-snug text-slate-400">
            Build structured interval workouts by hand — set target zones, work and recovery
            durations, and repeats, then push them straight to your calendar. For now, browse the
            library or ask the coach for a session.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
