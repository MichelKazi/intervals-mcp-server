import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CalendarPlus } from 'lucide-react';
import { Eyebrow } from '@coaching/ui';

import AppShell from '@/components/AppShell';
import { Input } from '@/components/ui/input';
import { SkeletonCard } from '@/components/viz';
import { callMcp, getWellness, validateFtpGoal } from '@/lib/api';
import { preComputeGoal, type PreComputedGoalContext } from '@/lib/ftp/compute';
import type { Achievability } from '@/lib/ftp/constants';
import type { WellnessDay } from '@/lib/types';

// ─── Derivations ────────────────────────────────────────────────────────────

const DEFAULT_FTP = 290;
const DEFAULT_CTL = 48;

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

// Achievability → status band color + StatusPill-style semantics.
const BAND: Record<Achievability, { border: string; bg: string; text: string; label: string }> = {
  conservative: { border: 'border-status-green/40', bg: 'bg-status-green/10', text: 'text-status-green', label: 'Conservative' },
  moderate: { border: 'border-status-green/40', bg: 'bg-status-green/10', text: 'text-status-green', label: 'Moderate' },
  aggressive: { border: 'border-status-yellow/40', bg: 'bg-status-yellow/10', text: 'text-status-yellow', label: 'Aggressive' },
  unrealistic: { border: 'border-status-red/40', bg: 'bg-status-red/10', text: 'text-status-red', label: 'Unrealistic' },
};

// Hard-reject (not physically possible) always renders the red band.
function bandFor(c: PreComputedGoalContext): (typeof BAND)[Achievability] {
  if (!c.isPhysicallyPossible) {
    return { border: 'border-status-red/40', bg: 'bg-status-red/10', text: 'text-status-red', label: 'Not achievable' };
  }
  return BAND[c.achievability];
}

// A month out — a realistic default that clears the 14-day minimum.
function defaultTargetDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 56);
  return d.toISOString().slice(0, 10);
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

  const athleteText = typeof athleteQ.data === 'string' ? athleteQ.data : athleteQ.data?.result ?? '';
  const currentFtp = parseFtp(athleteText) ?? DEFAULT_FTP;
  const currentCtl = latestCtl(wellnessQ.data ?? []) ?? DEFAULT_CTL;

  // Start at 0 so nothing is "set" yet — the goal is below-current until the
  // rider types a real target, so no validation request fires on mount.
  const [targetFtp, setTargetFtp] = useState(0);
  const [targetDate, setTargetDate] = useState(defaultTargetDate);

  const [scheduled, setScheduled] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleErr, setScheduleErr] = useState(false);

  // Synchronous validation. No network — this is the instant path.
  const computed = useMemo(
    () => preComputeGoal({ currentFtp, targetFtp, targetDate, currentCtl }),
    [currentFtp, targetFtp, targetDate, currentCtl],
  );

  // LLM enrichment. Fires only when the goal is physically possible, so a
  // hard-reject never touches the network.
  const assessQ = useQuery({
    queryKey: ['ftp-goal-validate', currentFtp, targetFtp, targetDate, currentCtl],
    queryFn: () => validateFtpGoal(computed),
    enabled: computed.isPhysicallyPossible,
  });

  const schedule = async () => {
    setScheduling(true);
    setScheduleErr(false);
    try {
      await callMcp('add_or_update_event', { name: 'FTP Test', type: 'Ride', start_date: targetDate });
      setScheduled(targetDate);
    } catch {
      setScheduleErr(true);
    } finally {
      setScheduling(false);
    }
  };

  const band = bandFor(computed);
  const roundedWeeks = Math.round(computed.weeksAvailable);
  const enriched = computed.isPhysicallyPossible && assessQ.data;
  const coachingNote = enriched ? assessQ.data!.coaching_note : computed.validationMessage;
  const confidence = enriched ? assessQ.data!.confidence_pct : computed.baseConfidence;
  const riskFactors = enriched ? assessQ.data!.risk_factors : [];
  const loadingProfile = athleteQ.isLoading || wellnessQ.isLoading;

  return (
    <AppShell title="FTP Goal" showBack>
      <div className="space-y-4 px-4 pb-20 pt-4">
        {/* Current state */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border-default bg-bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current FTP</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">
              {loadingProfile ? '—' : `${currentFtp}W`}
            </div>
          </div>
          <div className="rounded-xl border border-border-default bg-bg-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Current CTL</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-slate-100">
              {loadingProfile ? '—' : Math.round(currentCtl)}
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section className="rounded-xl border border-border-default bg-bg-surface p-4">
          <Eyebrow>Set Goal</Eyebrow>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-widest text-slate-500">Target FTP (W)</span>
              <Input
                type="number"
                inputMode="numeric"
                aria-label="Target FTP"
                value={targetFtp}
                onChange={(e) => setTargetFtp(Number(e.target.value))}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-widest text-slate-500">Target date</span>
              <Input
                type="date"
                aria-label="Target date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* Instant validation band */}
        <section
          data-testid="validation-band"
          data-achievability={computed.isPhysicallyPossible ? computed.achievability : 'impossible'}
          className={`rounded-xl border p-4 ${band.border} ${band.bg}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13px] font-semibold ${band.text}`}>{band.label}</span>
            {computed.isPhysicallyPossible && (
              <span className="font-mono text-[12px] text-slate-300">
                {computed.gainRequired > 0 ? `+${computed.gainRequired}W` : `${computed.gainRequired}W`} · {roundedWeeks}w
              </span>
            )}
          </div>

          {/* Coaching note: deterministic instantly, replaced by the LLM note when it resolves. */}
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

        {/* Schedule action — only when the goal is valid. */}
        {computed.isPhysicallyPossible &&
          (scheduled ? (
            <section className="flex items-center gap-3 rounded-xl border border-status-green/40 bg-status-green/10 p-4">
              <CheckCircle2 size={18} className="shrink-0 text-status-green" aria-hidden="true" />
              <p className="text-[13px] text-status-green">
                FTP test scheduled for <span className="font-mono">{scheduled}</span>.
              </p>
            </section>
          ) : (
            <button
              onClick={schedule}
              disabled={scheduling}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-semibold text-bg-base disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarPlus size={18} strokeWidth={2.5} aria-hidden="true" />
              {scheduling ? 'Scheduling…' : 'Schedule FTP test'}
            </button>
          ))}
        {scheduleErr && (
          <p className="text-center text-[12px] text-status-red">Could not schedule. Try again.</p>
        )}
      </div>
    </AppShell>
  );
}
