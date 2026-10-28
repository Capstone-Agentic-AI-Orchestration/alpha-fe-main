import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBoardSyncCoordinator } from './boardSyncCoordinator';

afterEach(() => vi.useRealTimers());

describe('board sync coordinator', () => {
  it('collapses duplicate and out-of-order notices into one debounced catch-up', async () => {
    vi.useFakeTimers();
    const catchUp = vi.fn().mockResolvedValue(undefined);
    const coordinator = createBoardSyncCoordinator(catchUp);

    coordinator.notify();
    await vi.advanceTimersByTimeAsync(200);
    coordinator.notify();
    coordinator.notify();
    await vi.advanceTimersByTimeAsync(399);
    expect(catchUp).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(catchUp).toHaveBeenCalledOnce();

    coordinator.dispose();
  });

  it('schedules exactly one more catch-up for notices received during an active read', async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const catchUp = vi.fn()
      .mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const coordinator = createBoardSyncCoordinator(catchUp);

    coordinator.notify();
    await vi.advanceTimersByTimeAsync(400);
    expect(catchUp).toHaveBeenCalledOnce();
    coordinator.notify();
    coordinator.notify();
    finishFirst();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);

    expect(catchUp).toHaveBeenCalledTimes(2);
    coordinator.dispose();
  });

  it('does nothing while hidden and catches up once when visibility returns', async () => {
    vi.useFakeTimers();
    const catchUp = vi.fn().mockResolvedValue(undefined);
    const coordinator = createBoardSyncCoordinator(catchUp);
    coordinator.onVisible(false);
    coordinator.notify();
    await vi.advanceTimersByTimeAsync(500);
    expect(catchUp).not.toHaveBeenCalled();

    coordinator.onVisible(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(catchUp).toHaveBeenCalledOnce();
    coordinator.dispose();
  });

  it('catches up after a channel subscription is restored', async () => {
    vi.useFakeTimers();
    const catchUp = vi.fn().mockResolvedValue(undefined);
    const coordinator = createBoardSyncCoordinator(catchUp);

    coordinator.onSubscribed();
    await vi.advanceTimersByTimeAsync(400);

    expect(catchUp).toHaveBeenCalledOnce();
    coordinator.dispose();
  });
});
