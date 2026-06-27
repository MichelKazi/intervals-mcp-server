import { useLocation, Link } from 'react-router-dom';
import { Home, Calendar, BookOpen, MoreHorizontal, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface Tab {
  path: string;
  label: string;
  Icon: LucideIcon;
}

const TABS: Tab[] = [
  { path: '/', label: 'Home', Icon: Home },
  { path: '/calendar', label: 'Calendar', Icon: Calendar },
  { path: '/library', label: 'Library', Icon: BookOpen },
  { path: '/more', label: 'More', Icon: MoreHorizontal },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[100] flex h-16 border-t border-border-subtle bg-bg-surface pb-safe"
      aria-label="Main navigation"
    >
      {TABS.map(({ path, label, Icon }) => {
        const isActive =
          path === '/' ? pathname === '/' : pathname.startsWith(path);
        return (
          <Link
            key={path}
            to={path}
            data-testid={`nav-tab-${label.toLowerCase()}`}
            className={cn(
              'relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'text-accent' : 'text-slate-500',
            )}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <span
                className="absolute inset-x-0 top-0 h-0.5 bg-accent"
                aria-hidden="true"
              />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
