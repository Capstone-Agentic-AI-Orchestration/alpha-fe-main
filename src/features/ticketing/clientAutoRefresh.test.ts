import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeClientMessages, startClientAutoRefresh } from './clientAutoRefresh';
import type { ClientProjectProposal, ClientTicketMessage } from './clientApi';
import { projectProposalPortalUpdate } from './ClientNotificationBell';

let visibility: EventTarget & { visibilityState: string };
beforeEach(() => {
  vi.useFakeTimers();
  visibility = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('window', globalThis);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('client update refresh', () => {
  it('refreshes every 30 seconds without replacing the initial page load', async () => {
    const refresh = vi.fn(async () => undefined);
    const stop = startClientAutoRefresh(refresh);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });
  it('pauses hidden tabs and refreshes when the client returns', async () => {
    const refresh = vi.fn(async () => undefined);
    const stop = startClientAutoRefresh(refresh);
    visibility.visibilityState = 'hidden';
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).not.toHaveBeenCalled();
    visibility.visibilityState = 'visible'; visibility.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
    stop();
  });
  it('does not overlap slow requests', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = startClientAutoRefresh(refresh);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish(); await Promise.resolve(); stop();
  });
  it('removes timers and visibility listeners on exit', async () => {
    const refresh = vi.fn(async () => undefined);
    startClientAutoRefresh(refresh)();
    visibility.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('can refresh again after a failed attempt', async () => {
    const refresh = vi.fn(async () => undefined).mockRejectedValueOnce(new Error('offline'));
    const stop = startClientAutoRefresh(refresh);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(2); stop();
  });
  it('creates a stable update for the latest PM proposal question only while awaiting a client reply', () => {
    const proposal: ClientProjectProposal = {
      id: 'proposal-1', title: 'Client portal', description: 'Build a portal', requestedDeadline: null,
      submittedAt: '2026-10-29T08:00:00Z', status: 'awaiting_client', clarificationMessages: [
        { id: 'question-old', author: 'pm', body: 'Earlier question', createdAt: '2026-10-29T09:00:00Z' },
        { id: 'reply-old', author: 'client', body: 'Earlier response', createdAt: '2026-10-29T10:00:00Z' },
        { id: 'question-current', author: 'pm', body: 'Which customers first?', createdAt: '2026-10-30T08:00:00Z' },
      ],
    };
    const update = projectProposalPortalUpdate(proposal);
    expect(update).toMatchObject({
      id: 'proposal:proposal-1:question-current', title: 'Project proposal needs your reply',
      message: 'Client portal', timestamp: '2026-10-30T08:00:00Z', target: { kind: 'proposal', item: proposal },
    });
    expect(projectProposalPortalUpdate({ ...proposal, status: 'pending' })).toBeNull();
  });
  it('keeps older loaded messages and orders new messages without duplicates', () => {
    const old = { id: 'old', author: 'pm', body: 'Earlier', createdAt: '2026-10-24T01:00:00Z' } as ClientTicketMessage;
    const latest = { ...old, id: 'new', body: 'Update', createdAt: '2026-10-24T02:00:00Z' };
    const previous = [old];
    expect(mergeClientMessages(previous, [latest, old])).toEqual([old, latest]);
    expect(previous).toEqual([old]);
    expect(mergeClientMessages(previous, [{ ...old }])).toBe(previous);
  });
});
