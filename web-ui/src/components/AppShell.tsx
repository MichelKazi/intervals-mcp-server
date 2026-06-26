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
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header
        className="fixed inset-x-0 top-0 z-[100] flex items-end border-b border-border bg-card px-4 pb-2 pt-safe"
        style={{ height: 'calc(56px + env(safe-area-inset-top))' }}
      >
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
        <h1 className="m-0 flex-1 text-[17px] font-semibold">{title}</h1>
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
