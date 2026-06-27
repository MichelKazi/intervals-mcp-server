import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CalendarPlus, Trash2 } from 'lucide-react';
import { Eyebrow } from '@coaching/ui';

import AppShell from '@/components/AppShell';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/viz';
import {
  callMcp,
  getWellness,
  validateFtpGoal,
  suggestPlanName,
  savePlan,
  getActivePlan,
  archivePlan,
} from '@/lib/api';
import { preComputeGoal, type PreComputedGoalContext } from '@/lib/ftp/compute';
import {
  buildPlanSkeleton,
  defaultHardWeekdays,
  WEEKDAY_LABELS,
  INJECTION_WEEKDAY,
  DAY_TYPE_COLOR,
  DAY_TYPE_LABEL,
  type PlanSkeleton,
  type DayType,
} from '@/lib/ftp/plan';
import { reconcilePlan, type Adjustment } from '@/lib/ftp/reconcile';
import { MICHEL } from '@/lib/ftp/constants';
import type { Achievability } from '@/lib/ftp/constants';
import type { WellnessDay, TrainingPlan } from '@/lib/types';

// ─── Derivations ────────────────────────────────────────────────────────────

const DEFAULT_FTP = 290;
const DEFAULT_CTL = 48;
const PEAK_FTP = MICHEL.ALL_TIME_PEAK_FTP;
const TYPE_ORDER: DayType[] = ['hard', 'endurance', 'recovery', 'rest'];

function latestCtl(days: WellnessDay[]): number | null {
  for (let i = days.length - 1; i >= 0; i--) {
    if (typeof days[i].ctl === 'number') return days[i].ctl as number;
  }
  return null;
}

function parseFtp(athleteText: string): number | null {
  const m = athleteText.match(/FTP:\s*(\d+)\s*W/i);
  return m ? Number(m[1]) : null;
}

function parseAthleteId(athleteText: string): string | null {
  const m = athleteText.match(/i\d{4,}/i);
  return m ? m[0] : null;
}

// Achievability → status band color + StatusPill-style semantics.
const BAND: Record<Achievability, { border: string; bg: string; text: string; label: string }> = {
  conservative: { border: 'border-status-green/40', bg: 'bg-status-green/10', text: 'text-status-green', label: 'Conservative' },
  moderate: { border: 'border-status-green/40', bg: 'bg-status-green/10', text: 'text-status-green', label: 'Moderate' },
  aggressive: { border: 'border-status-yellow/40', bg: 'bg-status-yellow/10', text: 'text-status-yellow', label: 'Aggressive' },
  unrealistic: { border: 'border-status-red/40', bg: 'bg-status-red/10', text: 'text-status-red', label: 'Unrealistic' },
};

function bandFor(c: PreComputedGoalContext): (typeof BAND)[Achievability] {
  if (!c.isPhysicallyPossible) {
    return { border: 'border-status-red/40', bg: 'bg-status-red/10', text: 'text-status-red', label: 'Not achievable' };
  }
  return BAND[c.achievability];
}

// Default goal date: ~8 weeks out, clears the 14-day minimum.
function defaultTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
}

// Per-day workout name by type.
function workoutName(type: DayType, primaryWorkout: string): string {
  switch (type) {
    case 'hard':
      return `Hard — ${primaryWorkout}`;
    case 'endurance':
      return 'Z1 Endurance';
    case 'recovery':
      return 'Recovery Z1';
    default:
      return 'Rest';
  }
}

/** Debounce any value by `ms`. Used to gate the LLM enrich behind slider idle. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const ADJ_TONE: Record<Adjustment['severity'], string> = {
  info: 'border-status-green/40 bg-status-green/10 text-status-green',
  warn: 'border-status-yellow/40 bg-status-yellow/10 text-status-yellow',
};

// ─── Calendar preview ─────────────────────────────────────────────────────────

function CalendarPreview({ skeleton }: { skeleton: PlanSkeleton }) {
  return (
    <section className="card" data-testid="calendar-preview">
      <Eyebrow>Calendar Preview</Eyebrow>

      {/* Weekday column headers */}
      <div className="mt-3 grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] items-center gap-1 px-0.5">
        <span />
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} className="text-center text-[10px] font-medium uppercase text-slate-500">
            {label.charAt(0)}
          </span>
        ))}
      </div>

      <div className="mt-1.5 flex flex-col gap-1.5">
        {skeleton.weeks.map((week) => (
          <div
            key={week.weekNumber}
            className={`grid grid-cols-[2rem_repeat(7,minmax(0,1fr))] items-center gap-1 rounded-lg px-0.5 py-1 ${
              week.isRecoveryWeek ? 'bg-status-yellow/5 ring-1 ring-status-yellow/20' : ''
            }`}
          >
            <span className="text-[10px] font-mono text-slate-500">W{week.weekNumber}</span>
            {week.days.map((day) => (
              <span key={day.date} className="flex justify-center">
                <span
                  className={`h-3.5 w-3.5 rounded-full ${DAY_TYPE_COLOR[day.type]}`}
                  title={`${day.date} · ${DAY_TYPE_LABEL[day.type]}`}
                  aria-label={`${day.date} ${DAY_TYPE_LABEL[day.type]}`}
                />
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {TYPE_ORDER.map((t) => (
          <span key={t} className="row gap-1.5 text-[11px] text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-full ${DAY_TYPE_COLOR[t]}`} />
            {DAY_TYPE_LABEL[t]}
          </span>
        ))}
      </div>

      {(skeleton.spacingWarnings.length > 0 || skeleton.injectionConflict) && (
        <ul className="mt-3 space-y-1" data-testid="plan-warnings">
          {skeleton.injectionConflict && (
            <li className="text-[12px] leading-snug text-status-yellow">
              • Thursday is your injection day — that hard session was moved to endurance.
            </li>
          )}
          {skeleton.spacingWarnings.map((w, i) => (
            <li key={i} className="text-[12px] leading-snug text-status-yellow">
              • {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Active plan card ───────────────────────────────────────────────────────

function ActivePlanCard({
  plan,
  readiness,
  tsb,
  onClear,
  clearing,
}: {
  plan: TrainingPlan;
  readiness: 'green' | 'yellow' | 'red' | null;
  tsb: number | null;
  onClear: () => void;
  clearing: boolean;
}) {
  const skeleton = plan.skeleton as PlanSkeleton;
  const goal = plan.goal as Partial<PreComputedGoalContext> | undefined;
  const targetFtp = goal?.input?.targetFtp;

  const adjustments = useMemo(
    () => reconcilePlan({ skeleton, completedDates: [], readiness, tsb }),
    [skeleton, readiness, tsb],
  );

  const weeksRemaining = useMemo(() => {
    const today = Date.now();
    const future = skeleton.weeks.filter(
      (w) => new Date(w.days[0].date + 'T00:00:00').getTime() + 7 * 86_400_000 >= today,
    );
    return future.length;
  }, [skeleton]);

  return (
    <section className="card" data-testid="active-plan">
      <div className="row-between">
        <Eyebrow color="accent">Active Plan</Eyebrow>
        <button
          onClick={onClear}
          disabled={clearing}
          className="row gap-1 text-[12px] text-slate-400 hover:text-status-red disabled:opacity-50"
        >
          <Trash2 size={14} aria-hidden="true" />
          {clearing ? 'Clearing…' : 'Clear plan'}
        </button>
      </div>
      <div className="mt-2 text-[16px] font-semibold text-slate-100">{plan.name}</div>
      <div className="mt-1 flex items-center gap-4 font-mono text-[12px] text-slate-400">
        {typeof targetFtp === 'number' && (
          <span>
            <span className="text-slate-500">Target</span> {targetFtp}W
          </span>
        )}
        <span>
          <span className="text-slate-500">Weeks left</span> {weeksRemaining}
        </span>
      </div>

      <ul className="mt-3 space-y-2" data-testid="active-plan-adjustments">
        {adjustments.map((a, i) => (
          <li key={i} className={`rounded-lg border p-2.5 ${ADJ_TONE[a.severity]}`}>
            <div className="text-[13px] font-semibold">{a.title}</div>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-300">{a.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FtpGoal() {
  const newest = new Date().toISOString().slice(0, 10);
  const oldest = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);

  const athleteQ = useQuery({
    queryKey: ['athlete'],
    queryFn: () => callMcp('get_athlete', {}) as Promise<{ result?: string } | string>,
  });
  const wellnessQ = useQuery({
    queryKey: ['ftp-goal-wellness', oldest, newest],
    queryFn: () => getWellness(oldest, newest),
  });
  const activePlanQ = useQuery({
    queryKey: ['active-plan'],
    queryFn: getActivePlan,
  });

  const athleteText = typeof athleteQ.data === 'string' ? athleteQ.data : athleteQ.data?.result ?? '';
  const currentFtp = parseFtp(athleteText) ?? DEFAULT_FTP;
  const athleteId = parseAthleteId(athleteText);
  const currentCtl = latestCtl(wellnessQ.data ?? []) ?? DEFAULT_CTL;
  const loadingProfile = athleteQ.isLoading || wellnessQ.isLoading;

  // Latest readiness/TSB for the active-plan reconcile.
  const fitnessDays = (wellnessQ.data ?? []).filter((d) => d.ctl != null && d.atl != null);
  const latestDay = fitnessDays.length ? fitnessDays[fitnessDays.length - 1] : undefined;
  const tsb = latestDay && latestDay.ctl != null && latestDay.atl != null
    ? (latestDay.ctl as number) - (latestDay.atl as number)
    : null;

  // Slider target. Start AT current FTP so the goal is below-current (impossible)
  // until the rider moves the slider — nothing validates on mount, matching the
  // FieldTest/FtpGoal "nothing set yet" pattern.
  const [targetFtp, setTargetFtp] = useState(0);
  const [targetTouched, setTargetTouched] = useState(false);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);
  const [hardWeekdays, setHardWeekdays] = useState<number[]>(defaultHardWeekdays);
  const [planName, setPlanName] = useState('');
  const [planNameDirty, setPlanNameDirty] = useState(false);

  // Track the slider against the live FTP floor: until touched, pin to current
  // (gain 0 = below-current = impossible), so the first render fires no network.
  const effectiveTarget = targetTouched ? targetFtp : currentFtp;

  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState<{ done: number; total: number } | null>(null);
  const [builtId, setBuiltId] = useState<string | null>(null);
  const [buildErr, setBuildErr] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Synchronous validation — the instant path, no network.
  const computed = useMemo(
    () => preComputeGoal({ currentFtp, targetFtp: effectiveTarget, targetDate, currentCtl }),
    [currentFtp, effectiveTarget, targetDate, currentCtl],
  );
  const roundedWeeks = Math.max(1, Math.round(computed.weeksAvailable));

  // Deterministic skeleton — also instant.
  const skeleton = useMemo(
    () => buildPlanSkeleton({ hardWeekdays, weeks: roundedWeeks }),
    [hardWeekdays, roundedWeeks],
  );

  // Debounce the goal inputs so dragging the slider doesn't spam directeur.
  const debouncedFtp = useDebounced(effectiveTarget, 600);
  const debouncedDate = useDebounced(targetDate, 600);
  const debouncedComputed = useMemo(
    () => preComputeGoal({ currentFtp, targetFtp: debouncedFtp, targetDate: debouncedDate, currentCtl }),
    [currentFtp, debouncedFtp, debouncedDate, currentCtl],
  );

  // Bucket the enrich query key so multiple settles in one bucket = one request.
  const enrichBucket = [
    debouncedComputed.achievability,
    Math.round(debouncedComputed.gainRequired / 5) * 5,
    weeksBucket(debouncedComputed.weeksAvailable),
    debouncedComputed.isReturningTowardPeak,
  ].join('|');

  const assessQ = useQuery({
    queryKey: ['ftp-goal-validate', enrichBucket],
    queryFn: () => validateFtpGoal(debouncedComputed),
    enabled: debouncedComputed.isPhysicallyPossible,
  });

  // Plan-name suggestion — debounced behind a valid goal + chosen days.
  const nameBucket = [
    debouncedComputed.achievability,
    Math.round(debouncedComputed.gainRequired / 5) * 5,
    weeksBucket(debouncedComputed.weeksAvailable),
    [...hardWeekdays].sort().join(','),
  ].join('|');
  const nameQ = useQuery({
    queryKey: ['plan-name', nameBucket],
    queryFn: () =>
      suggestPlanName({
        computed: debouncedComputed,
        hard_weekdays: hardWeekdays,
        weeks: roundedWeeks,
      }),
    enabled: debouncedComputed.isPhysicallyPossible && hardWeekdays.length >= 2,
  });

  // Prefill name from the suggestion unless the user has edited it.
  useEffect(() => {
    if (!planNameDirty && nameQ.data?.name) setPlanName(nameQ.data.name);
  }, [nameQ.data?.name, planNameDirty]);

  const toggleHardDay = (wd: number) => {
    if (wd === INJECTION_WEEKDAY) return;
    setHardWeekdays((prev) => {
      if (prev.includes(wd)) {
        if (prev.length <= 2) return prev; // enforce min 2
        return prev.filter((d) => d !== wd);
      }
      if (prev.length >= 3) return prev; // enforce max 3
      return [...prev, wd].sort((a, b) => a - b);
    });
  };

  const band = bandFor(computed);
  const enriched = computed.isPhysicallyPossible && assessQ.data;
  const coachingNote = enriched ? assessQ.data!.coaching_note : computed.validationMessage;
  const confidence = enriched ? assessQ.data!.confidence_pct : computed.baseConfidence;
  const riskFactors = enriched ? assessQ.data!.risk_factors : [];

  const canBuild =
    computed.isPhysicallyPossible && hardWeekdays.length >= 2 && hardWeekdays.length <= 3;

  const build = async () => {
    setBuilding(true);
    setBuildErr(false);
    setBuildProgress(null);
    try {
      const saved = await savePlan({
        athlete_id: athleteId ?? undefined,
        name: planName || `${computed.gainRequired}W Build`,
        goal: computed,
        hard_weekdays: hardWeekdays,
        weeks: roundedWeeks,
        start_date: skeleton.startDate,
        skeleton,
      });
      const id = saved.id;
      const primary = computed.planTemplate.primaryWorkout;
      const days = skeleton.weeks.flatMap((w) => w.days).filter((d) => d.type !== 'rest');
      setBuildProgress({ done: 0, total: days.length });
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        await callMcp('add_or_update_event', {
          workout_type: 'Ride',
          name: workoutName(day.type, primary),
          start_date: day.date,
        });
        setBuildProgress({ done: i + 1, total: days.length });
      }
      setBuiltId(id);
      activePlanQ.refetch();
    } catch {
      setBuildErr(true);
    } finally {
      setBuilding(false);
    }
  };

  const activePlan = activePlanQ.data?.plan ?? null;
  const readinessVerdict = useMemo<'green' | 'yellow' | 'red' | null>(() => {
    const r = latestDay?.readiness;
    if (typeof r !== 'number') return null;
    return r >= 67 ? 'green' : r >= 34 ? 'yellow' : 'red';
  }, [latestDay]);

  const clearPlan = async () => {
    if (!activePlan) return;
    setClearing(true);
    try {
      await archivePlan(activePlan.id);
      await activePlanQ.refetch();
    } catch {
      // best-effort; surface nothing destructive
    } finally {
      setClearing(false);
    }
  };

  return (
    <AppShell title="Plan Builder" showBack>
      <div className="screen">
        {/* Active plan, when one exists, sits at the top. */}
        {activePlan && (
          <ActivePlanCard
            plan={activePlan}
            readiness={readinessVerdict}
            tsb={tsb}
            onClear={clearPlan}
            clearing={clearing}
          />
        )}

        {/* a. Current state */}
        <section className="stat-grid">
          <div className="card">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current FTP</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">
              {loadingProfile ? '—' : `${currentFtp}W`}
            </div>
          </div>
          <div className="card">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current CTL</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">
              {loadingProfile ? '—' : Math.round(currentCtl)}
            </div>
          </div>
        </section>

        {/* b. FTP slider */}
        <section className="card">
          <div className="row-between">
            <Eyebrow>Target FTP</Eyebrow>
            <span className="font-mono text-2xl font-semibold text-accent" data-testid="target-ftp">
              {effectiveTarget}W
            </span>
          </div>
          <input
            type="range"
            aria-label="Target FTP"
            min={currentFtp}
            max={PEAK_FTP}
            step={1}
            value={effectiveTarget}
            onChange={(e) => {
              setTargetTouched(true);
              setTargetFtp(Number(e.target.value));
            }}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-bg-high accent-accent"
          />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-slate-500">
            <span>{currentFtp}W</span>
            <span>peak {PEAK_FTP}W</span>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-widest text-slate-500">Target date</span>
            <Input
              type="date"
              aria-label="Target date"
              className="w-full min-w-0"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </section>

        {/* Instant validation band */}
        <section
          data-testid="validation-band"
          data-achievability={computed.isPhysicallyPossible ? computed.achievability : 'impossible'}
          className={`rounded-2xl border p-4 ${band.border} ${band.bg}`}
        >
          <div className="row-between">
            <span className={`text-[13px] font-semibold ${band.text}`}>{band.label}</span>
            {computed.isPhysicallyPossible && (
              <span className="font-mono text-[12px] text-slate-300">
                {computed.gainRequired > 0 ? `+${computed.gainRequired}W` : `${computed.gainRequired}W`} · {roundedWeeks}w
              </span>
            )}
          </div>

          {computed.isPhysicallyPossible && assessQ.isLoading ? (
            <div className="mt-2">
              <SkeletonCard rows={2} />
            </div>
          ) : (
            <p className="mt-2 text-[13px] leading-snug text-slate-300" data-testid="coaching-note">
              {coachingNote}
            </p>
          )}

          {computed.returningAdvantageNote && (
            <p className="mt-2 text-[12px] leading-snug text-accent">{computed.returningAdvantageNote}</p>
          )}

          {computed.isPhysicallyPossible && (
            <div className="mt-3 flex items-center gap-4 font-mono text-[12px] text-slate-400">
              <span data-testid="confidence">
                <span className="text-slate-500">Confidence</span> {confidence}%
              </span>
              <span>
                <span className="text-slate-500">Plan</span> {computed.planTemplate.label}
              </span>
            </div>
          )}

          {riskFactors.length > 0 && (
            <ul className="mt-3 space-y-1" data-testid="risk-factors">
              {riskFactors.map((r, i) => (
                <li key={i} className="text-[12px] leading-snug text-status-yellow">
                  • {r}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* c. Hard-days picker */}
        <section className="card" data-testid="hard-days">
          <Eyebrow>Hard Days</Eyebrow>
          <p className="mt-1 text-[12px] text-slate-400">Pick 2–3. Thursday is your injection day.</p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label, wd) => {
              const isInjection = wd === INJECTION_WEEKDAY;
              const selected = hardWeekdays.includes(wd);
              const atMax = hardWeekdays.length >= 3 && !selected;
              const disabled = isInjection || atMax;
              return (
                <button
                  key={wd}
                  type="button"
                  aria-label={label}
                  aria-pressed={selected}
                  disabled={isInjection}
                  onClick={() => toggleHardDay(wd)}
                  className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border text-[12px] font-semibold transition-colors ${
                    selected
                      ? 'border-accent bg-accent/15 text-accent'
                      : isInjection
                        ? 'cursor-not-allowed border-border-default bg-bg-high/40 text-slate-600'
                        : atMax
                          ? 'border-border-default text-slate-600'
                          : 'border-border-default text-slate-300 hover:border-accent/50'
                  } ${disabled && !isInjection ? 'opacity-60' : ''}`}
                >
                  {label.charAt(0)}
                </button>
              );
            })}
          </div>
          {skeleton.injectionConflict ? null : (
            <p className="mt-2 text-[11px] text-slate-500" data-testid="injection-hint">
              Thursday stays endurance — injection day.
            </p>
          )}
        </section>

        {/* d. Calendar preview */}
        <CalendarPreview skeleton={skeleton} />

        {/* e. Plan name */}
        <section className="card">
          <div className="row-between">
            <Eyebrow>Plan Name</Eyebrow>
            {nameQ.isFetching && !planNameDirty && (
              <span className="text-[11px] text-slate-500">suggesting…</span>
            )}
          </div>
          <Input
            type="text"
            aria-label="Plan name"
            className="mt-3 w-full"
            placeholder="Spring Threshold Build"
            value={planName}
            onChange={(e) => {
              setPlanName(e.target.value);
              setPlanNameDirty(true);
            }}
          />
        </section>

        {/* f. Build & schedule */}
        {canBuild &&
          (builtId ? (
            <section className="row rounded-2xl border border-status-green/40 bg-status-green/10 p-4">
              <CheckCircle2 size={18} className="shrink-0 text-status-green" aria-hidden="true" />
              <p className="text-[13px] text-status-green">
                Plan built and scheduled{buildProgress ? ` (${buildProgress.total} sessions)` : ''}.
              </p>
            </section>
          ) : (
            <button
              onClick={build}
              disabled={building}
              data-testid="build-schedule"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[14px] font-semibold text-bg-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarPlus size={18} strokeWidth={2.5} aria-hidden="true" />
              {building
                ? buildProgress
                  ? `Scheduling ${buildProgress.done}/${buildProgress.total}…`
                  : 'Building…'
                : 'Build & Schedule'}
            </button>
          ))}
        {buildErr && (
          <p className="text-center text-[12px] text-status-red">Could not build the plan. Try again.</p>
        )}
      </div>
    </AppShell>
  );
}

// Weeks bucket for the enrich cache key: matches directeur's bucketing.
function weeksBucket(weeks: number): string {
  if (weeks <= 2) return '<=2';
  if (weeks <= 4) return '<=4';
  if (weeks <= 8) return '<=8';
  if (weeks <= 12) return '<=12';
  if (weeks <= 20) return '<=20';
  return '>20';
}
