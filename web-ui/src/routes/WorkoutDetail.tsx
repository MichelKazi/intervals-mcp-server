import { useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell title={`Workout ${id ?? ''}`} showBack>
      <p style={{ color: 'var(--text-dim)', padding: 'var(--sp-4)' }}>WorkoutDetail — coming soon</p>
    </AppShell>
  );
}
