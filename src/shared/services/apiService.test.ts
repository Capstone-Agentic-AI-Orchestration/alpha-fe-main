import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiRequestError, apiService, onWorkspaceRefused, parseApiError, setActiveWorkspaceId } from './apiService';

afterEach(() => { vi.unstubAllGlobals(); setActiveWorkspaceId(null); onWorkspaceRefused(null); });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('existing API transport compatibility', () => {
  it('preserves existing project request cookies, selected workspace and error message format', async () => {
    setActiveWorkspaceId('workspace-existing');
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'Existing permission refusal.' }, 403)); vi.stubGlobal('fetch', fetchMock);
    try { await apiService.getProjects(); throw new Error('Expected a refusal'); }
    catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(parseApiError(error)).toEqual({ status: 403, message: 'Existing permission refusal.' });
    }
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).get('X-Workspace-Id')).toBe('workspace-existing');
  });
  it('keeps existing workspace-refusal recovery for non-ticket requests', async () => {
    const handler = vi.fn(); setActiveWorkspaceId('workspace-existing'); onWorkspaceRefused(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'You do not have access to the requested workspace.' }, 403)));
    await expect(apiService.getProjects()).rejects.toBeInstanceOf(Error);
    expect(handler).toHaveBeenCalledExactlyOnceWith('workspace-existing');
  });
  it('does not label ordinary project network failures as uncertain ticket writes', async () => {
    const original = new TypeError('Test-only failed network'); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original));
    await expect(apiService.getProjects()).rejects.toBe(original);
  });
});

describe('squad build cancellation', () => {
  it('posts cancellation for the selected squad run', async () => {
    const cancelledRun = { id: 'squad-run-1', status: 'cancelled' };
    const fetchMock = vi.fn().mockResolvedValue(json(cancelledRun));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.cancelSquadRun(cancelledRun.id)).resolves.toEqual(cancelledRun);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/squad-runs\/squad-run-1\/cancel$/);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });
});

describe('new ticket helper stays within its namespace', () => {
  it('accepts the actual PM queue URL including its query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [] })); vi.stubGlobal('fetch', fetchMock);
    await expect(apiService.ticketRequest('/tickets?limit=50&filter=all')).resolves.toEqual({ items: [] });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/tickets\?limit=50&filter=all$/);
  });
  it.each(['/projects', '/tickets/../projects', '/tickets/%2e%2e/projects', '/tickets/./commands',
    '/tickets/id/../../projects', '//attacker.example/tickets', '/tickets\\projects', '/tickets#fragment', '/tickets\n'])('rejects namespace escape %s before fetch', async path => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    await expect(apiService.ticketRequest(path)).rejects.toThrow(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retains the selected workspace and normal error shape for ticket requests', async () => {
    setActiveWorkspaceId('workspace-existing');
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'Ticket changed.', code: 'ticket_version_conflict' }, 409)); vi.stubGlobal('fetch', fetchMock);
    await expect(apiService.ticketRequest('/tickets/id/commands', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ status: 409, code: 'ticket_version_conflict', reconciliationRequired: false, message: 'API Error [409]: Ticket changed.' });
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.credentials).toBe('include');
    expect(new Headers(options.headers).get('X-Workspace-Id')).toBe('workspace-existing');
  });
  it('marks only ticket write network uncertainty for same-operation reconciliation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Test-only transport failure')));
    await expect(apiService.ticketRequest('/tickets/id/commands', { method: 'POST', body: '{}' }))
      .rejects.toMatchObject({ name: 'ApiRequestError', reconciliationRequired: true, code: 'ticket_transport_outcome_unknown' });
    await expect(apiService.ticketRequest('/tickets/id')).rejects.not.toBeInstanceOf(ApiRequestError);
  });
});
