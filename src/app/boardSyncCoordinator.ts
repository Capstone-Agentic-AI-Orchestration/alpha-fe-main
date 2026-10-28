export interface BoardSyncCoordinator {
  notify(): void;
  onVisible(visible?: boolean): void;
  onSubscribed(): void;
  dispose(): void;
}

/** Debounce doorbells and keep only one board catch-up request in flight. */
export function createBoardSyncCoordinator(
  catchUp: () => Promise<void>,
  debounceMs = 400
): BoardSyncCoordinator {
  const delay = Number.isFinite(debounceMs) ? Math.max(0, debounceMs) : 400;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = typeof document === 'undefined' || document.visibilityState === 'visible';
  let running = false;
  let dirty = false;
  let rerunRequested = false;
  let disposed = false;

  const schedule = () => {
    if (disposed || !visible) return;
    if (running) {
      rerunRequested = true;
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delay);
  };

  const run = async () => {
    if (disposed || !visible) return;
    if (running) {
      rerunRequested = true;
      return;
    }
    running = true;
    dirty = false;
    try {
      await catchUp();
    } catch {
      // A later doorbell, reconnect, or visibility restore will retry.
    } finally {
      running = false;
      if (disposed) return;
      if (rerunRequested || dirty) {
        rerunRequested = false;
        schedule();
      }
    }
  };

  const notify = () => {
    if (disposed) return;
    dirty = true;
    if (!visible) return;
    schedule();
  };

  const onVisible = (nextVisible?: boolean) => {
    if (disposed) return;
    const wasVisible = visible;
    visible = typeof nextVisible === 'boolean'
      ? nextVisible
      : typeof document === 'undefined' || document.visibilityState === 'visible';
    if (!visible) {
      if (timer) clearTimeout(timer);
      timer = null;
    } else if (!wasVisible || dirty) {
      schedule();
    }
  };

  const dispose = () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    dirty = false;
    rerunRequested = false;
  };

  return { notify, onVisible, onSubscribed: notify, dispose };
}
