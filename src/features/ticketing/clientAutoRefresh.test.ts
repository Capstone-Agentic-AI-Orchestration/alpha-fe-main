import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeClientMessages, startClientAutoRefresh } from './clientAutoRefresh';
import type { ClientTicketMessage } from './clientApi';

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
  it('keeps older loaded messages and orders new messages without duplicates', () => {
    const old = { id: 'old', author: 'pm', body: 'Earlier', createdAt: '2026-10-24T01:00:00Z' } as ClientTicketMessage;
    const latest = { ...old, id: 'new', body: 'Update', createdAt: '2026-10-24T02:00:00Z' };
    const previous = [old];
    expect(mergeClientMessages(previous, [latest, old])).toEqual([old, latest]);
    expect(previous).toEqual([old]);
    expect(mergeClientMessages(previous, [{ ...old }])).toBe(previous);
  });
});
