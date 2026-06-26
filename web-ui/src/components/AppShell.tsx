import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';

interface AppShellProps {
  title: string;
  showBack?: boolean;
  children: ReactNode;
}

export default function AppShell({ title, showBack, children }: AppShellProps) {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--sp-4)',
          zIndex: 100,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              cursor: 'pointer',
              padding: 'var(--sp-2)',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 'var(--sp-2)',
            }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, flex: 1 }}>{title}</h1>
      </header>
      <main
        style={{
          paddingTop: 56,
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
