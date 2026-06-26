import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import AppShell from '@/components/AppShell';
import { SkeletonCard } from '@/components/viz';
import { callMcp } from '@/lib/api';

// ─── Athlete profile parsing ──────────────────────────────────────────────────

interface Profile {
  name: string | null;
  ftp: number | null;
  lthr: number | null;
  city: string | null;
}

function parseProfile(text: string): Profile {
  const grab = (re: RegExp) => text.match(re)?.[1]?.trim() ?? null;
  const ftpStr = grab(/FTP:\s*(\d+)\s*W/i);
  const lthrStr = grab(/LTHR:\s*(\d+)\s*bpm/i);
  return {
    name: grab(/Name:\s*(.+)/),
    ftp: ftpStr ? Number(ftpStr) : null,
    lthr: lthrStr ? Number(lthrStr) : null,
    city: grab(/City:\s*(.+)/),
  };
}

// ─── Local prefs ──────────────────────────────────────────────────────────────

const PREFS_KEY = 'coach-prefs';

interface Prefs {
  units: 'metric' | 'imperial';
  weekStart: 'monday' | 'sunday';
  tirzepatideReminder: boolean;
}

const DEFAULT_PREFS: Prefs = { units: 'metric', weekStart: 'monday', tirzepatideReminder: false };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

// ─── MCP health ───────────────────────────────────────────────────────────────

function useServerHealth() {
  return useQuery({
    queryKey: ['mcp-health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('unhealthy');
      return res.json() as Promise<{ status: string; version?: string }>;
    },
    refetchInterval: 30_000,
    retry: false,
  });
}

// ─── Small controls ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[13px] text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? 'bg-accent' : 'bg-border-strong'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-bg-base p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-[36px] rounded-md px-3 text-[12px] font-medium transition-colors ${value === o.v ? 'bg-bg-high text-slate-100' : 'text-slate-500'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const athleteQ = useQuery({
    queryKey: ['settings-athlete'],
    queryFn: () => callMcp('get_athlete', {}) as Promise<{ result?: string } | string>,
  });
  const health = useServerHealth();

  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <AppShell title="Settings" showBack>
      <div className="space-y-4 px-4 pb-20 pt-4">
        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-500">Athlete Profile</h2>
          {athleteQ.isLoading ? (
            <SkeletonCard rows={3} className="border-0 bg-transparent p-0" />
          ) : athleteQ.isError ? (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-slate-400">Could not load profile.</p>
              <button onClick={() => athleteQ.refetch()} className="min-h-[44px] text-[13px] font-semibold text-accent">Retry</button>
            </div>
          ) : (() => {
            const p = parseProfile(typeof athleteQ.data === 'string' ? athleteQ.data : athleteQ.data?.result ?? '');
            return (
              <div className="divide-y divide-border-subtle">
                <Row label="Name"><span className="text-[13px] font-medium text-slate-100">{p.name ?? '—'}</span></Row>
                <Row label="FTP"><span className="font-mono text-[13px] text-slate-100">{p.ftp != null ? `${p.ftp}W` : '—'}</span></Row>
                <Row label="LTHR"><span className="font-mono text-[13px] text-slate-100">{p.lthr != null ? `${p.lthr}bpm` : '—'}</span></Row>
                <Row label="Location"><span className="text-[13px] text-slate-100">{p.city ?? '—'}</span></Row>
              </div>
            );
          })()}
          <p className="mt-2 text-[11px] text-slate-500">Read-only — edit on intervals.icu.</p>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-slate-500">Server Status</h2>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${health.isLoading ? 'bg-slate-500' : health.isError ? 'bg-status-red' : 'bg-status-green'}`}
              aria-hidden="true"
            />
            <span className="text-[13px] text-slate-100" data-testid="server-status">
              {health.isLoading ? 'Checking…' : health.isError ? 'Offline' : 'Online'}
            </span>
            {health.data?.version && <span className="ml-auto font-mono text-[11px] text-slate-500">v{health.data.version}</span>}
          </div>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-1 text-[11px] font-medium uppercase tracking-widest text-slate-500">Display</h2>
          <Row label="Units">
            <Segmented value={prefs.units} onChange={(v) => set('units', v)} options={[{ v: 'metric', label: 'Metric' }, { v: 'imperial', label: 'Imperial' }]} />
          </Row>
          <Row label="Week starts">
            <Segmented value={prefs.weekStart} onChange={(v) => set('weekStart', v)} options={[{ v: 'monday', label: 'Mon' }, { v: 'sunday', label: 'Sun' }]} />
          </Row>
        </section>

        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <h2 className="mb-1 text-[11px] font-medium uppercase tracking-widest text-slate-500">Reminders</h2>
          <Row label="Tirzepatide reminder">
            <Toggle on={prefs.tirzepatideReminder} onChange={(v) => set('tirzepatideReminder', v)} label="Toggle tirzepatide reminder" />
          </Row>
        </section>
      </div>
    </AppShell>
  );
}
