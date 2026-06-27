import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus } from 'lucide-react';
import { Eyebrow } from '@coaching/ui';

import AppShell from '@/components/AppShell';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/viz';
import {
  getProfile,
  updateProfileCore,
  updateProfileContext,
  addMedication,
  removeMedication,
  type AddMedicationBody,
} from '@/lib/api';
import type { AthleteContext, AthleteDemographics, AthleteProfile } from '@/lib/types';

// ─── Local prefs ──────────────────────────────────────────────────────────────

const PREFS_KEY = 'coach-prefs';

interface Prefs {
  units: 'metric' | 'imperial';
  weekStart: 'monday' | 'sunday';
  doseReminders: boolean;
}

const DEFAULT_PREFS: Prefs = { units: 'metric', weekStart: 'monday', doseReminders: false };

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_PREFS;
  }
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    <div className="row-between py-2.5">
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

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-muted px-3 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1 rounded-lg bg-bg-base p-1">
      {options.map((o) => (
        <button
          key={o.v}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={`min-h-[36px] rounded-md px-3 text-[12px] font-medium transition-colors ${value === o.v ? 'bg-bg-high text-slate-100' : 'text-slate-500'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Text field that commits its value on blur (or Enter) via `onCommit`. */
function EditableField({
  label,
  value,
  type = 'text',
  placeholder,
  textarea,
  onCommit,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <label className="flex flex-col gap-1.5 py-2.5">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">{label}</span>
      {textarea ? (
        <textarea
          aria-label={label}
          className="min-h-[72px] w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <Input
          type={type}
          aria-label={label}
          className="w-full min-w-0"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </label>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Settings() {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const health = useServerHealth();

  // Any successful write returns the refreshed profile — seed the cache and refetch.
  const onWrite = (next: AthleteProfile) => {
    qc.setQueryData(['profile'], next);
    qc.invalidateQueries({ queryKey: ['profile'] });
  };

  const coreMut = useMutation({
    mutationFn: (body: Partial<AthleteDemographics>) => updateProfileCore(body),
    onSuccess: onWrite,
  });
  const contextMut = useMutation({
    mutationFn: (body: Partial<AthleteContext>) => updateProfileContext(body),
    onSuccess: onWrite,
  });
  const addMedMut = useMutation({
    mutationFn: (body: AddMedicationBody) => addMedication(body),
    onSuccess: onWrite,
  });
  const removeMedMut = useMutation({
    mutationFn: (id: string) => removeMedication(id),
    onSuccess: onWrite,
  });

  const profile = profileQ.data;
  const athlete = profile?.athlete;
  const ctx = profile?.context;
  const meds = (profile?.medications ?? []).filter((m) => m.active);

  return (
    <AppShell title="Settings" showBack>
      <div className="screen">
        {/* ── Demographics (always editable) ── */}
        <section className="card">
          <Eyebrow>Athlete Profile</Eyebrow>
          {profileQ.isLoading ? (
            <SkeletonCard rows={4} className="mt-2 border-0 bg-transparent p-0" />
          ) : profileQ.isError ? (
            <div className="row-between mt-2">
              <p className="text-[13px] text-slate-400">Could not load profile.</p>
              <button onClick={() => profileQ.refetch()} className="min-h-[44px] text-[13px] font-semibold text-accent">
                Retry
              </button>
            </div>
          ) : (
            <div className="mt-1 divide-y divide-border-subtle">
              <EditableField label="Name" value={athlete?.name ?? ''} onCommit={(v) => coreMut.mutate({ name: v || null })} />
              <EditableField
                label="Weight (kg)"
                type="number"
                value={athlete?.weight_kg != null ? String(athlete.weight_kg) : ''}
                onCommit={(v) => coreMut.mutate({ weight_kg: v.trim() === '' ? null : Number(v) })}
              />
              <Row label="Sex">
                <Segmented
                  ariaLabel="Sex"
                  value={(athlete?.sex ?? '') as string}
                  onChange={(v) => coreMut.mutate({ sex: v || null })}
                  options={[{ v: 'M', label: 'M' }, { v: 'F', label: 'F' }]}
                />
              </Row>
              <EditableField
                label="Gender identity"
                value={athlete?.gender_identity ?? ''}
                placeholder="optional"
                onCommit={(v) => coreMut.mutate({ gender_identity: v || null })}
              />
              <EditableField
                label="Location"
                value={athlete?.location ?? ''}
                placeholder="City, Country"
                onCommit={(v) => coreMut.mutate({ location: v || null })}
              />
              <EditableField
                label="Birth date"
                type="date"
                value={athlete?.birth_date ?? ''}
                onCommit={(v) => coreMut.mutate({ birth_date: v || null })}
              />
            </div>
          )}
          {coreMut.isError && <p className="mt-2 text-[11px] text-status-red">Could not save. Try again.</p>}
          <p className="mt-2 text-[11px] text-slate-500">FTP and LTHR stay authoritative on intervals.icu.</p>
        </section>

        {/* ── Consent ── */}
        <section className="card">
          <Eyebrow>Coaching Consent</Eyebrow>
          <p className="mt-1 text-[12px] text-slate-400">Control which context the coach is allowed to use.</p>
          <div className="mt-2 divide-y divide-border-subtle">
            <Row label="Use medical info">
              <Toggle
                on={!!ctx?.use_medical}
                onChange={(v) => contextMut.mutate({ use_medical: v })}
                label="Let the coach use medical info"
              />
            </Row>
            <Row label="Use lifestyle info">
              <Toggle
                on={!!ctx?.use_lifestyle}
                onChange={(v) => contextMut.mutate({ use_lifestyle: v })}
                label="Let the coach use lifestyle info"
              />
            </Row>
            <Row label="Use psychological info">
              <Toggle
                on={!!ctx?.use_psychological}
                onChange={(v) => contextMut.mutate({ use_psychological: v })}
                label="Let the coach use psychological info"
              />
            </Row>
          </div>
        </section>

        {/* ── Context (gated by lifestyle + psychological consent) ── */}
        {(ctx?.use_lifestyle || ctx?.use_psychological) && (
          <section className="card">
            <Eyebrow>Lifestyle & Mindset</Eyebrow>
            <p className="mt-1 text-[12px] text-slate-400">Feeds the coach when the matching consent is on.</p>
            <div className="mt-1 divide-y divide-border-subtle">
              {ctx?.use_lifestyle && (
                <>
                  <Row label="Job type">
                    {/* Keys match knowledge_cache.entity_key (job_type). */}
                    <select
                      aria-label="Job type"
                      className={selectCls}
                      value={(ctx?.job_type ?? '') as string}
                      onChange={(e) => contextMut.mutate({ job_type: e.target.value })}
                    >
                      <option value="">Select…</option>
                      <option value="sedentary_desk">Sedentary / desk</option>
                      <option value="knowledge_worker_high_stress">Desk, high stress</option>
                      <option value="manual_labor_construction">Manual labor</option>
                      <option value="standing_service_worker">Standing / service</option>
                      <option value="shift_work_night">Shift / night work</option>
                      <option value="commercial_driver_long_commute">Driver / long commute</option>
                      <option value="healthcare_clinical">Healthcare / clinical</option>
                      <option value="frequent_traveler">Frequent traveler</option>
                      <option value="student">Student</option>
                    </select>
                  </Row>
                  <EditableField
                    label="Free time"
                    value={ctx?.free_time ?? ''}
                    placeholder="When you can train"
                    onCommit={(v) => contextMut.mutate({ free_time: v || null })}
                  />
                  <EditableField
                    label="Mesocycle preference"
                    value={ctx?.mesocycle_preference ?? ''}
                    placeholder="e.g. 2+1 short mesocycles"
                    onCommit={(v) => contextMut.mutate({ mesocycle_preference: v || null })}
                  />
                  <EditableField
                    label="Training history"
                    textarea
                    value={ctx?.training_history_notes ?? ''}
                    onCommit={(v) => contextMut.mutate({ training_history_notes: v || null })}
                  />
                </>
              )}
              {ctx?.use_psychological && (
                <>
                  <EditableField
                    label="Mood"
                    value={ctx?.mood ?? ''}
                    placeholder="e.g. motivated, focused"
                    onCommit={(v) => contextMut.mutate({ mood: v || null })}
                  />
                  <EditableField
                    label="Motivation"
                    value={ctx?.motivation ?? ''}
                    onCommit={(v) => contextMut.mutate({ motivation: v || null })}
                  />
                  <EditableField
                    label="Dropout risk"
                    textarea
                    value={ctx?.dropout_risk ?? ''}
                    onCommit={(v) => contextMut.mutate({ dropout_risk: v || null })}
                  />
                </>
              )}
            </div>
          </section>
        )}

        {/* ── Medications (meaningful only when medical consent is on) ── */}
        <section className="card" data-testid="medications-card">
          <Eyebrow>Medications</Eyebrow>
          {!ctx?.use_medical ? (
            <p className="mt-1 text-[12px] text-slate-400">
              Turn on “Use medical info” for the coach to factor these into readiness.
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-slate-400">Active meds the coach accounts for in readiness and dose-day load.</p>
          )}

          <ul className="mt-2 divide-y divide-border-subtle">
            {meds.length === 0 && <li className="py-2.5 text-[13px] text-slate-500">None.</li>}
            {meds.map((m) => (
              <li key={m.id} className="row-between py-2.5" data-testid="med-row">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-slate-100">{m.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {[m.drug_class, m.schedule_weekday != null ? WEEKDAY_NAMES[m.schedule_weekday] : null]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <button
                  aria-label={`Remove ${m.name}`}
                  disabled={removeMedMut.isPending}
                  onClick={() => removeMedMut.mutate(m.id)}
                  className="row min-h-[36px] shrink-0 gap-1 px-1 text-[12px] text-slate-400 hover:text-status-red disabled:opacity-50"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          <AddMedicationForm
            disabled={addMedMut.isPending}
            onAdd={(body) => addMedMut.mutate(body)}
          />
          {(addMedMut.isError || removeMedMut.isError) && (
            <p className="mt-2 text-[11px] text-status-red">Could not update medications. Try again.</p>
          )}
        </section>

        {/* ── Server status ── */}
        <section className="card">
          <Eyebrow>Server Status</Eyebrow>
          <div className="row mt-2 gap-2">
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

        {/* ── Display prefs (local) ── */}
        <section className="card">
          <Eyebrow>Display</Eyebrow>
          <div className="mt-1">
            <Row label="Units">
              <Segmented value={prefs.units} onChange={(v) => set('units', v)} options={[{ v: 'metric', label: 'Metric' }, { v: 'imperial', label: 'Imperial' }]} />
            </Row>
            <Row label="Week starts">
              <Segmented value={prefs.weekStart} onChange={(v) => set('weekStart', v)} options={[{ v: 'monday', label: 'Mon' }, { v: 'sunday', label: 'Sun' }]} />
            </Row>
            <Row label="Dose-day reminders">
              <Toggle on={prefs.doseReminders} onChange={(v) => set('doseReminders', v)} label="Toggle dose-day reminders" />
            </Row>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

// ─── Add medication form ────────────────────────────────────────────────────

function AddMedicationForm({ disabled, onAdd }: { disabled: boolean; onAdd: (body: AddMedicationBody) => void }) {
  const [name, setName] = useState('');
  const [drugClass, setDrugClass] = useState('');
  const [weekday, setWeekday] = useState('');
  const [notes, setNotes] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({
      name: trimmed,
      drug_class: drugClass || undefined,
      schedule_weekday: weekday === '' ? undefined : Number(weekday),
      notes: notes.trim() || undefined,
    });
    setName('');
    setDrugClass('');
    setWeekday('');
    setNotes('');
  };


  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border-default bg-bg-base p-3">
      <span className="text-[11px] uppercase tracking-widest text-slate-500">Add medication</span>
      <Input aria-label="Medication name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full min-w-0" />
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Drug class" className={selectCls} value={drugClass} onChange={(e) => setDrugClass(e.target.value)}>
          {/* Keys match knowledge_cache.entity_key (medication_class) so the
              coach finds class knowledge. Common subset; "other" leaves it blank. */}
          <option value="">Class…</option>
          <option value="glp1_gip">GLP-1 / GIP</option>
          <option value="stimulant">Stimulant</option>
          <option value="ssri">SSRI</option>
          <option value="snri_other_antidepressant">SNRI / other antidepressant</option>
          <option value="beta_blocker">Beta blocker</option>
          <option value="antihypertensive_non_bb">Antihypertensive (non-BB)</option>
          <option value="statin">Statin</option>
          <option value="metformin">Metformin</option>
          <option value="thyroid_hormone">Thyroid hormone</option>
          <option value="corticosteroid_systemic">Corticosteroid (systemic)</option>
          <option value="nsaid">NSAID</option>
          <option value="antihistamine">Antihistamine</option>
          <option value="hormonal_contraceptive">Hormonal contraceptive</option>
          <option value="other">Other</option>
        </select>
        <select aria-label="Schedule weekday" className={selectCls} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
          <option value="">Day…</option>
          {WEEKDAY_NAMES.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <Input aria-label="Medication notes" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full min-w-0" />
      <button
        onClick={submit}
        disabled={disabled || !name.trim()}
        data-testid="add-med"
        className="row min-h-[44px] justify-center gap-2 rounded-lg bg-accent text-[13px] font-semibold text-bg-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        Add
      </button>
    </div>
  );
}
