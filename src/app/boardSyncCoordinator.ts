export interface BoardSyncCoordinator {
  notify(): void;
  onVisible(visible?: boolean): void;
  onSubscribed(): void;
  onRealtimeUnavailable(): void;
  dispose(): void;
}

/** Debounce doorbells, recover missed notices, and keep one catch-up in flight. */
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
  let realtimeConnected = false;
  let fallback: ReturnType<typeof setInterval> | null = null;

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
      // A later doorbell, fallback tick, reconnect, or visibility restore retries.
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

  const startFallback = () => {
    if (disposed || realtimeConnected || fallback) return;
    fallback = setInterval(notify, 30_000);
  };

  const stopFallback = () => {
    if (!fallback) return;
    clearInterval(fallback);
    fallback = null;
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

  // Cursor polling covers missing or disconnected Realtime subscriptions. Stop
  // polling while subscribed; reconnecting triggers one catch-up below.
  startFallback();

  const onSubscribed = () => {
    if (disposed) return;
    const wasConnected = realtimeConnected;
    realtimeConnected = true;
    stopFallback();
    if (!wasConnected) notify();
  };

  const onRealtimeUnavailable = () => {
    if (disposed) return;
    const wasConnected = realtimeConnected;
    realtimeConnected = false;
    startFallback();
    if (wasConnected) notify();
  };

  const dispose = () => {
    disposed = true;
    stopFallback();
    if (timer) clearTimeout(timer);
    timer = null;
    dirty = false;
    rerunRequested = false;
  };

  return { notify, onVisible, onSubscribed, onRealtimeUnavailable, dispose };
}
