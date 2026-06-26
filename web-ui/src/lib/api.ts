import type {
  Dashboard, Activity, ActivityIntervals, Stream, PlannedEvent,
  LibraryWorkout, WellnessDay, Compliance
} from './types';

// Default to same-origin: the PWA is served by the same FastAPI app that hosts
// /api/*, so relative requests always reach the backend that served the page.
// Override with VITE_API_BASE only when the UI is hosted separately from the API.
const BASE = import.meta.env.VITE_API_BASE ?? '';

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
  if (res.status === 204 || res.headers?.get('content-length') === '0') {
    return undefined as T;
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

export function pairActivity(eventId: string | number, activityId: string | number): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${eventId}/pair`, { method: 'POST', body: JSON.stringify({ activity_id: activityId }) });
}

export function unpairActivity(eventId: string | number): Promise<PlannedEvent> {
  return apiFetch(`/api/events/${eventId}/unpair`, { method: 'POST' });
}

export function getCompliance(eventId: string | number): Promise<Compliance> {
  return apiFetch(`/api/events/${eventId}/compliance`);
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

export function getMcpTools(): Promise<unknown[]> {
  return apiFetch('/api/mcp/tools');
}

// ── Coaching chat (DeepSeek via directeur, through the MCP/coaching layer) ──
export function getCoachingBrief(): Promise<unknown> {
  return callMcp('get_coaching_brief', {});
}

export function analyzeActivity(activityId: string | number): Promise<unknown> {
  return callMcp('analyze_activity', { activity_id: String(activityId) });
}
