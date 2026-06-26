import { useNavigate } from 'react-router-dom';
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

import AppShell from '@/components/AppShell';

interface ToolCard {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
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
      { slug: 'race-hub', title: 'Race Hub', description: 'Upcoming races and target events', icon: Flag, iconColor: 'text-accent' },
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
      { slug: 'coaching-chat', title: 'Coaching Chat', description: 'Ask your AI coach anything', icon: MessageSquare, iconColor: 'text-accent' },
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
      className="flex min-h-[44px] flex-col gap-3 rounded-xl bg-bg-raised p-4 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon size={20} className={card.iconColor} strokeWidth={2} />
      <div>
        <div className="text-[13px] font-semibold leading-tight text-slate-100">
          {card.title}
        </div>
        <div className="mt-0.5 text-[11px] leading-snug text-slate-500">
          {card.description}
        </div>
      </div>
    </button>
  );
}

export default function More() {
  return (
    <AppShell title="More">
      <div className="space-y-6 px-4 pb-20 pt-4">
        {SECTIONS.map(section => (
          <section key={section.title}>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-500">
              {section.title}
            </h2>
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
