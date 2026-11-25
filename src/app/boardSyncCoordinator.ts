export interface BoardSyncCoordinator {
  notify(): void;
  onVisible(visible?: boolean): void;
  onSubscribed(): void;
  onRealtimeUnavailable(): void;
  dispose(): void;
}

/**
 * What to tell the person when a board catch-up failed, or nothing.
 *
 * Only the server saying it could not produce the board (5xx): a desktop
 * whose team board will not load otherwise just shows an empty workspace,
 * which reads as "nobody has made a project yet". A dropped connection or a
 * refusal has its own handling and retries quietly.
 */
export function boardSyncFailureMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number' || status < 500) return null;
  return error.message.replace(/^API Error \[\d+\]:\s*/, '').trim() || null;
}

/** Debounce doorbells, recover missed notices, and keep one catch-up in flight. */
export function createBoardSyncCoordinator(
  catchUp: () => Promise<void>,
  debounceMs = 400,
  /** Told about each failed catch-up; retrying stays the coordinator's job. */
  onError?: (error: unknown) => void
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
    } catch (error) {
      // A later doorbell, fallback tick, reconnect, or visibility restore retries.
      if (!disposed) onError?.(error);
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
