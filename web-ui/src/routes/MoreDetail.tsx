import { useParams } from 'react-router-dom';

import AppShell from '@/components/AppShell';

function titleFromSlug(slug?: string): string {
  if (!slug) return 'Coming Soon';
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Placeholder screen for /more/<slug> until each tool is built out. */
export default function MoreDetail() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <AppShell title={titleFromSlug(slug)} showBack>
      <div className="flex flex-col items-center justify-center gap-2 px-6 pb-20 pt-24 text-center">
        <p className="text-base font-semibold text-slate-100">Coming soon</p>
        <p className="text-[13px] text-slate-400">This screen is under construction.</p>
      </div>
    </AppShell>
  );
}
