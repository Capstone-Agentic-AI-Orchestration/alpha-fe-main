import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiService } from './apiService';
import { fetchServerSnapshot } from './serverSync';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); }
  } as unknown as Storage;
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('server hydration with a board cursor', () => {
  it('keeps non-board hydration while board rows come only from cursor sync', async () => {
    vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue({
      workspaceId: 'ws-1', cursor: { workspaceId: 'ws-1', value: '12' }, projects: [], agents: [], issues: []
    });
    const fullBoardReads = [
      vi.spyOn(apiService, 'getProjects'), vi.spyOn(apiService, 'getAgents'), vi.spyOn(apiService, 'getIssues')
    ];
    vi.spyOn(apiService, 'getSkills').mockResolvedValue([]);
    vi.spyOn(apiService, 'getRuntimes').mockResolvedValue([]);
    vi.spyOn(apiService, 'getChatThreads').mockResolvedValue([]);
    const runs = vi.spyOn(apiService, 'getRuns').mockResolvedValue([]);
    vi.spyOn(apiService, 'getAnalytics').mockResolvedValue({} as never);
    vi.spyOn(apiService, 'getSquadRuns').mockResolvedValue([]);

    const result = await fetchServerSnapshot('ws-1');

    expect(fullBoardReads.every(call => !call.mock.calls.length)).toBe(true);
    // The web reads run summaries; stage logs load when a run is opened.
    expect(runs).toHaveBeenCalledWith('summary');
    expect(result.snapshot).toMatchObject({ skills: [], runtimes: [], chatThreads: [], runs: [], squadRuns: [], analytics: {} });
    expect(result.failures).toEqual({});
    expect(result.board.cursor).toEqual({ workspaceId: 'ws-1', value: '12' });
  });

  it('reports a failed chat read without replacing it with an empty list', async () => {
    vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue({
      workspaceId: 'ws-1', cursor: { workspaceId: 'ws-1', value: '12' }, projects: [], agents: [], issues: []
    });
    vi.spyOn(apiService, 'getSkills').mockResolvedValue([]);
    vi.spyOn(apiService, 'getRuntimes').mockResolvedValue([]);
    vi.spyOn(apiService, 'getChatThreads').mockRejectedValue(new Error('API Error [403]: Sign in with GitHub to use Alpha.'));
    vi.spyOn(apiService, 'getRuns').mockResolvedValue([]);
    vi.spyOn(apiService, 'getAnalytics').mockResolvedValue({} as never);
    vi.spyOn(apiService, 'getSquadRuns').mockResolvedValue([]);

    const result = await fetchServerSnapshot('ws-1');

    expect(result.snapshot).not.toHaveProperty('chatThreads');
    expect(result.failures).toMatchObject({
      chatThreads: 'API Error [403]: Sign in with GitHub to use Alpha.'
    });
  });
});
