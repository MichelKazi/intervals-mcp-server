import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';

interface AppShellProps {
  title: string;
  showBack?: boolean;
  children: ReactNode;
}

export default function AppShell({ title, showBack, children }: AppShellProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-foreground font-ui">
      <header
        className="aura-glass fixed inset-x-0 top-0 z-[100] flex items-center gap-1 border-b border-border-subtle px-4 pt-safe"
        style={{ height: 'calc(56px + env(safe-area-inset-top))' }}
      >
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Go back"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
        )}
        <h1 className="m-0 min-w-0 flex-1 truncate text-[17px] font-semibold leading-none">{title}</h1>
      </header>
      <main
        style={{
          paddingTop: 'calc(56px + env(safe-area-inset-top))',
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
