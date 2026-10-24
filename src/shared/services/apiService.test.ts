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

describe('multi-repository project builds', () => {
  it('sends the full repository selection with the project chat request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ userMessage: {}, agentMessage: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.sendChatMessage({
      threadId: 'thread-1',
      content: 'Build the full stack feature.',
      repositories: ['acme/app-fe', 'acme/app-be'],
      intent: 'build'
    });

    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      repositories: ['acme/app-fe', 'acme/app-be'],
      intent: 'build'
    });
  });

  it('requests the selected repository run in the Live Build Room', async () => {
    const snapshot = { summary: { review: 0, failed: 0, stale: 0 } };
    const fetchMock = vi.fn().mockResolvedValue(json(snapshot));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.getLiveBuildRoom('project-1', 'run/with space')).resolves.toEqual(snapshot);

    expect(String(fetchMock.mock.calls[0][0])).toContain('runId=run%2Fwith%20space');
    expect((fetchMock.mock.calls[0][1] as RequestInit).cache).toBe('no-store');
  });

  it('passes the chat session identity with its Live Build Room request', async () => {
    const snapshot = { summary: { review: 0, failed: 0, stale: 0 } };
    const fetchMock = vi.fn().mockResolvedValue(json(snapshot));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.getLiveBuildRoom('project-1', undefined, 'thread/one');

    expect(String(fetchMock.mock.calls[0][0])).toContain('threadId=thread%2Fone');
  });

  it('uses one encoded private memory endpoint for read, save and clear', async () => {
    const memory = { threadId: 'thread/one', content: 'Decision: keep compatibility.', revision: 1 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(memory))
      .mockResolvedValueOnce(json(memory))
      .mockResolvedValueOnce(json({ success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.getChatThreadMemory('thread/one')).resolves.toEqual(memory);
    await expect(apiService.saveChatThreadMemory('thread/one', memory.content)).resolves.toEqual(memory);
    await expect(apiService.clearChatThreadMemory('thread/one')).resolves.toEqual({ success: true });

    expect(String(fetchMock.mock.calls[0][0])).toContain('/chat/threads/thread%2Fone/memory');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('PUT');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({ content: memory.content });
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe('DELETE');
  });

  it.each([{}, { summary: {} }, { summary: { review: '0', failed: 0, stale: 0 } }])(
    'rejects an incomplete Live Build Room snapshot before rendering: %j', async snapshot => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(snapshot)));

      await expect(apiService.getLiveBuildRoom('project-1')).rejects.toThrow('incomplete data');
    }
  );
});

describe('always-on desktop project orchestration', () => {
  it('reads local orchestrator availability for a selected project', async () => {
    const settings = { enabled: true, available: true, localOnly: true as const };
    const fetchMock = vi.fn().mockResolvedValue(json(settings));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.getProjectOrchestrationSettings('project/1')).resolves.toEqual(settings);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/project%2F1/orchestration-settings');
  });

  it('keeps the compatibility write endpoint enabled', async () => {
    const settings = { enabled: true, available: true, localOnly: true as const };
    const fetchMock = vi.fn().mockResolvedValue(json(settings));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.setProjectOrchestrationEnabled('project-1', true)).resolves.toEqual(settings);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PUT');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ enabled: true });
  });
});

describe('task workflow controls', () => {
  it('uses project-scoped endpoints and the task revision for retries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ runId: 'orchestration-1', status: 'executing', currentTaskId: 'task-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.retryOrchestrationTask('project/1', 'orchestration/1', 'task 1', 7);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/project%2F1/orchestrations/orchestration%2F1/tasks/task%201/retry');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ expectedTaskRevision: 7 });
  });

  it('posts resume and cancellation to the selected orchestration run', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ runId: 'orchestration-1', status: 'executing' }))
      .mockResolvedValueOnce(json({ runId: 'orchestration-1', status: 'cancelled' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.resumeOrchestration('project-1', 'orchestration-1');
    await apiService.cancelOrchestration('project-1', 'orchestration-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/orchestrations/orchestration-1/resume');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/orchestrations/orchestration-1/cancel');
    expect(fetchMock.mock.calls.every(([, options]) => (options as RequestInit).method === 'POST')).toBe(true);
  });

  it('submits an explicit, revision-checked final approval for a task build', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ runId: 'orchestration-1', status: 'completed', issueId: 'issue-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiService.approveOrchestration('project-1', 'orchestration-1', 8)).resolves.toMatchObject({ status: 'completed' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/project-1/orchestrations/orchestration-1/approve');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ expectedRevision: 8 });
  });
});

describe('interrupted planning recovery', () => {
  it('uses project-scoped inspect, preview, and keep-workspace actions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ runId: 'orchestration-1', state: 'needs_review', revision: 2 }))
      .mockResolvedValueOnce(json({ baseCommit: 'base', headCommit: 'head', branchName: 'saved', changedPaths: ['README.md'], pathsTruncated: false, diff: '+saved', truncated: false }))
      .mockResolvedValueOnce(json({ runId: 'orchestration-1', state: 'retained', revision: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiService.inspectOrchestrationPlanningRecovery('project/1', 'orchestration/1');
    await apiService.getOrchestrationPlanningRecoveryPreview('project/1', 'orchestration/1');
    await apiService.retainOrchestrationPlanningRecovery('project/1', 'orchestration/1', 2);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/projects/project%2F1/planning-recoveries/orchestration%2F1/inspect');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/projects/project%2F1/planning-recoveries/orchestration%2F1/diff');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBeUndefined();
    expect(String(fetchMock.mock.calls[2][0])).toContain('/projects/project%2F1/planning-recoveries/orchestration%2F1/retain');
    expect(JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string)).toEqual({ expectedRevision: 2 });
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
