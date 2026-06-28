import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Zap,
  BarChart2,
  PieChart,
  Wind,
  Sliders,
  CheckSquare,
  Flag,
  Target,
  AlertTriangle,
  Moon,
  Heart,
  Activity,
  MessageSquare,
  ClipboardList,
  Dumbbell,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { PMCChart, SparkLine, MetricValue, Eyebrow, type PMCDataPoint } from '@coaching/ui';

import AppShell from '@/components/AppShell';
import { getPmc, getWellness } from '@/lib/api';
import type { WellnessDay } from '@/lib/types';
import { dateRange } from '@/routes/more/_shared';

interface ToolCard {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  /** Accent treatment: orange-bordered card with matching title. */
  accent?: boolean;
  /** Violet title. */
  violet?: boolean;
}

interface Section {
  title: string;
  cards: ToolCard[];
}

const SECTIONS: Section[] = [
  {
    title: 'Analytics',
    cards: [
      { slug: 'fitness', title: 'Fitness', description: 'CTL, ATL, and TSB trends over time', icon: TrendingUp, iconColor: 'text-zone-1' },
      { slug: 'power-profile', title: 'Power Profile', description: 'Peak power curve across durations', icon: Zap, iconColor: 'text-zone-3' },
      { slug: 'volume', title: 'Volume', description: 'Weekly training load and hours', icon: BarChart2, iconColor: 'text-zone-2' },
      { slug: 'zone-distribution', title: 'Zone Distribution', description: 'Time spent in each training zone', icon: PieChart, iconColor: 'text-zone-4' },
      { slug: 'aerobic', title: 'Aerobic', description: 'Aerobic efficiency and decoupling', icon: Wind, iconColor: 'text-zone-1' },
      { slug: 'polarization', title: 'Polarization', description: 'Intensity distribution by session', icon: Sliders, iconColor: 'text-zone-2' },
      { slug: 'planned-vs-actual', title: 'Planned vs Actual', description: 'Compliance with scheduled training', icon: CheckSquare, iconColor: 'text-status-green' },
    ],
  },
  {
    title: 'Race',
    cards: [
      { slug: 'race-hub', title: 'Race Hub', description: 'Upcoming races and target events', icon: Flag, iconColor: 'text-accent', accent: true },
      { slug: 'race-readiness', title: 'Race Readiness', description: 'Form and freshness for target date', icon: Target, iconColor: 'text-accent' },
      { slug: 'fatigue-risk', title: 'Fatigue / Risk', description: 'Overreaching risk and injury flags', icon: AlertTriangle, iconColor: 'text-status-yellow' },
    ],
  },
  {
    title: 'Wellness',
    cards: [
      { slug: 'sleep', title: 'Sleep', description: 'Sleep duration and quality trends', icon: Moon, iconColor: 'text-zone-1' },
      { slug: 'readiness-history', title: 'Readiness History', description: 'Daily readiness scores over time', icon: Heart, iconColor: 'text-status-green' },
      { slug: 'body-metrics', title: 'Body Metrics', description: 'Weight, HRV, resting HR over time', icon: Activity, iconColor: 'text-zone-5' },
    ],
  },
  {
    title: 'Training',
    cards: [
      { slug: 'coaching-chat', title: 'Command Bar', description: 'Tell your coach what to do', icon: MessageSquare, iconColor: 'text-accent', violet: true },
      { slug: 'ftp-goal', title: 'FTP Goal', description: 'Set and validate an FTP target', icon: Target, iconColor: 'text-zone-3' },
      { slug: 'dose-log', title: 'Dose Log', description: 'Manual training load entries', icon: ClipboardList, iconColor: 'text-zone-2' },
    ],
  },
  {
    title: 'Tools',
    cards: [
      { slug: 'field-test', title: 'Field Test', description: 'FTP ramp and power test protocols', icon: Dumbbell, iconColor: 'text-zone-3' },
      { slug: 'settings', title: 'Settings', description: 'Athlete profile and preferences', icon: Settings2, iconColor: 'text-slate-400' },
    ],
  },
];

function ToolCardItem({ card }: { card: ToolCard }) {
  const navigate = useNavigate();
  const Icon = card.icon;
  return (
    <button
      type="button"
      onClick={() => navigate(`/more/${card.slug}`)}
      data-testid={`more-card-${card.slug}`}
      className={`aura-glass flex min-h-[44px] flex-col gap-3 rounded-2xl p-4 text-left transition-[transform,border-color] active:scale-[0.97] active:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        card.accent ? '!border-accent/50' : ''
      }`}
    >
      <Icon size={20} className={card.iconColor} strokeWidth={2} />
      <div>
        <div
          className={`text-[13px] font-semibold leading-tight ${
            card.accent || card.violet ? 'text-accent' : 'text-slate-100'
          }`}
        >
          {card.title}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
          {card.description}
        </div>
      </div>
    </button>
  );
}

/** Big CTL/ATL/TSB number with its label, colored per the mockup. */
function TrendStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <MetricValue value={value} size="2xl" color={color} />
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
    </div>
  );
}

/** Fitness Trend glass preview: CTL/ATL/TSB stats + a PMC chart, links to /more/fitness. */
function FitnessTrendCard() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['pmc', 56], queryFn: () => getPmc(56) });
  const pts: PMCDataPoint[] = data ?? [];
  const latest = pts.length ? pts[pts.length - 1] : null;

  return (
    <div className="aura-glass flex flex-col gap-4 rounded-2xl p-4" style={{ boxShadow: 'var(--glow-accent)' }}>
      <div className="flex items-center justify-between">
        <Eyebrow>Fitness Trend</Eyebrow>
        <button
          type="button"
          onClick={() => navigate('/more/fitness')}
          className="text-[12px] font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Full →
        </button>
      </div>

      <div className="grid grid-cols-3">
        <TrendStat value={Math.round(latest?.ctl ?? 0)} label="CTL" color="var(--z1)" />
        <TrendStat value={Math.round(latest?.atl ?? 0)} label="ATL" color="var(--z3)" />
        <TrendStat value={Math.round(latest?.tsb ?? 0)} label="TSB" color="#22c55e" />
      </div>

      {pts.length > 0 && <PMCChart data={pts} period="8w" />}

      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-zone-1" />Fitness</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-accent" />Fatigue</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded bg-status-green/40" />Form</span>
      </div>
    </div>
  );
}

/** One bordered glass wellness cell: big number + unit, colored sparkline below. */
function WellnessCell({
  value, unit, label, color, series,
}: { value: string; unit: string; label: string; color: string; series: number[] }) {
  return (
    <div className="aura-glass flex flex-col gap-1 rounded-2xl p-3">
      <div className="flex items-baseline gap-1">
        <MetricValue value={value} size="lg" color={color} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{unit}</span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{label}</span>
      <SparkLine data={series} color={color} width={88} height={20} showArea />
    </div>
  );
}

const HRV_COLOR = 'var(--brand)';
const RHR_COLOR = 'var(--z1)';
const SLEEP_COLOR = 'var(--z3)';

/** Trailing numeric series for a wellness field, oldest→newest, gaps dropped. */
function series(days: WellnessDay[], field: string): number[] {
  return days.map((d) => d[field] as number).filter((n): n is number => typeof n === 'number');
}

function WellnessRow() {
  const range = dateRange(14);
  const { data } = useQuery({
    queryKey: ['wellness', range.oldest, range.newest],
    queryFn: () => getWellness(range.oldest, range.newest),
  });
  const days = data ?? [];
  const latest = [...days].reverse();
  const hrv = latest.find((d) => d.hrv != null)?.hrv ?? 0;
  const rhr = latest.find((d) => d.restingHR != null)?.restingHR ?? 0;
  const sleepSecs = latest.find((d) => (d.sleepSecs as number) > 0)?.sleepSecs as number | undefined;
  const sleepHrs = sleepSecs ? sleepSecs / 3600 : 0;

  return (
    <div className="grid grid-cols-3 gap-3">
      <WellnessCell value={Math.round(hrv).toString()} unit="ms HRV" label="HRV" color={HRV_COLOR} series={series(days, 'hrv')} />
      <WellnessCell value={Math.round(rhr).toString()} unit="bpm RHR" label="RHR" color={RHR_COLOR} series={series(days, 'restingHR')} />
      <WellnessCell value={sleepHrs.toFixed(1)} unit="hrs Sleep" label="Sleep" color={SLEEP_COLOR} series={series(days, 'sleepSecs').map((s) => s / 3600)} />
    </div>
  );
}

export default function More() {
  return (
    <AppShell title="More">
      <div className="screen gap-6">
        <div>
          <h1 className="m-0 text-2xl font-bold text-slate-100">More</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Tools, analytics &amp; tracking</p>
        </div>

        <FitnessTrendCard />
        <WellnessRow />

        {SECTIONS.map(section => (
          <section key={section.title}>
            <div className="mb-3">
              <Eyebrow>{section.title}</Eyebrow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {section.cards.map(card => (
                <ToolCardItem key={card.slug} card={card} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
