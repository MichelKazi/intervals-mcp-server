import type {
  Dashboard, Activity, ActivityIntervals, Stream, PlannedEvent,
  LibraryWorkout, WellnessDay
} from './types';

const BASE = import.meta.env.VITE_API_BASE ?? 'https://intervals-web-api-production.up.railway.app';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = import.meta.env.VITE_API_TOKEN;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

function qs(params?: Record<string, string | number | boolean>): string {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) p.set(k, String(v));
  return '?' + p.toString();
}

export function getDashboard(): Promise<Dashboard> {
  return apiFetch('/api/dashboard');
}

export function getActivities(params?: Record<string, string | number>): Promise<Activity[]> {
  return apiFetch(`/api/activities${qs(params)}`);
}

export function getActivity(id: string | number): Promise<Activity> {
  return apiFetch(`/api/activities/${id}`);
}

export function getActivityIntervals(id: string | number): Promise<ActivityIntervals> {
  return apiFetch(`/api/activities/${id}/intervals`);
}

export function getActivityStreams(id: string | number, types?: string[]): Promise<Stream[]> {
  const q = types ? `?types=${types.join(',')}` : '';
  return apiFetch(`/api/activities/${id}/streams${q}`);
}

export function getEvents(oldest: string, newest: string): Promise<PlannedEvent[]> {
  return apiFetch(`/api/events?oldest=${oldest}&newest=${newest}`);
}

export function getEvent(id: string | number): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${id}`);
}

export function createEvent(body: unknown): Promise<PlannedEvent> {
  return apiFetch('/api/events', { method: 'POST', body: JSON.stringify(body) });
}

export function updateEvent(id: string | number, body: unknown): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteEvent(id: string | number): Promise<void> {
  return apiFetch(`/api/events/${id}`, { method: 'DELETE' });
}

export function moveEvent(id: string | number, start_date: string): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${id}/move`, { method: 'POST', body: JSON.stringify({ start_date }) });
}

export function markEventDone(id: string | number): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${id}/mark-done`, { method: 'POST' });
}

export function searchLibrary(params?: Record<string, string | number | boolean>): Promise<LibraryWorkout[]> {
  return apiFetch(`/api/library/search${qs(params)}`);
}

export function getLibraryWorkout(id: string): Promise<LibraryWorkout> {
  return apiFetch(`/api/library/${id}`);
}

export function getAlternatives(params?: Record<string, string | number>): Promise<LibraryWorkout[]> {
  return apiFetch(`/api/library/alternatives${qs(params)}`);
}

export function createCustomWorkout(body: unknown): Promise<unknown> {
  return apiFetch('/api/workouts/custom', { method: 'POST', body: JSON.stringify(body) });
}

export function getCoachingState(zone?: string): Promise<unknown> {
  return apiFetch(`/api/coaching/state${zone ? `?zone=${zone}` : ''}`);
}

export function getWellness(oldest: string, newest: string): Promise<WellnessDay[]> {
  return apiFetch(`/api/wellness?oldest=${oldest}&newest=${newest}`);
}

export function callMcp(tool: string, args?: Record<string, unknown>): Promise<unknown> {
  return apiFetch(`/api/mcp/${tool}`, { method: 'POST', body: JSON.stringify(args ?? {}) });
}
