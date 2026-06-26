import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboard, getEvents, callMcp } from './api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockClear();
});

describe('api', () => {
  it('getDashboard calls /api/dashboard', async () => {
    mockOk({ next_workout: null, latest_activity: null, readiness: null });
    await getDashboard();
    expect(mockFetch).toHaveBeenCalledOnce();
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toMatch('/api/dashboard');
  });

  it('getEvents builds URL with oldest and newest params', async () => {
    mockOk([]);
    await getEvents('2026-01-01', '2026-01-31');
    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toMatch('oldest=2026-01-01');
    expect(url).toMatch('newest=2026-01-31');
  });

  it('getDashboard throws on non-ok with message from body', async () => {
    mockError(400, { message: 'Bad request' });
    await expect(getDashboard()).rejects.toThrow('Bad request');
  });

  it('callMcp sends POST to /api/mcp/{tool_name} with args as bare body', async () => {
    mockOk({ result: 'ok' });
    await callMcp('get_training_block', { weeks: 4 });
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch('/api/mcp/get_training_block');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ weeks: 4 });
  });
});
