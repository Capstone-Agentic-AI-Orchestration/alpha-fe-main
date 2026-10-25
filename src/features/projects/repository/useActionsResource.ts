import { useEffect, useRef, useState } from 'react';
import { ApiRequestError, parseApiError } from '@/shared/services/apiService';

export function actionsError(error: unknown): string {
  const { status, message } = parseApiError(error);
  if (status === 401) return 'Sign in to GitHub again from Settings to view Actions.';
  if (status === 403) return `Access was refused. Check project assignment, GitHub Actions read access, and organization SSO. ${message}`;
  if (status === 429) return 'GitHub is limiting requests. Refresh will resume after the retry interval.';
  if (status === 404) return 'This run or record is unavailable, deleted, or not accessible to your account.';
  return message;
}

/** No cross-account cache. A key change hides old data synchronously and aborts its request. */
export function useActionsResource<T>(fetcher: (signal: AbortSignal) => Promise<T>, key: string, active: boolean, refreshMs = 0) {
  const fn = useRef(fetcher); fn.current = fetcher;
  const [nonce, reload] = useState(0);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null; loading: boolean; updated: string | null }>({ key, data: null, error: null, loading: true, updated: null });
  useEffect(() => {
    const change = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!active || !visible) return;
    let stopped = false, failures = 0;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      setState(s => s.key === key ? { ...s, loading: true } : { key, data: null, error: null, loading: true, updated: null });
      let retryAfter = 0;
      try {
        const data = await fn.current(controller.signal);
        if (!stopped) setState({ key, data, loading: false, error: null, updated: new Date().toISOString() });
        failures = 0;
      } catch (error) {
        if (stopped) return;
        failures += 1;
        const status = parseApiError(error).status;
        if (error instanceof ApiRequestError) retryAfter = (error.retryAfterSeconds || 0) * 1000;
        setState(s => ({ key, data: s.key === key && status !== 401 && status !== 403 ? s.data : null,
          loading: false, error: actionsError(error), updated: s.key === key ? s.updated : null }));
        // Authorization needs a user decision, not a repeating background request.
        if (status === 401 || status === 403 && !retryAfter) return;
      }
      if (!stopped && refreshMs > 0) timer = setTimeout(read, Math.max(retryAfter, Math.min(300000, refreshMs * 2 ** Math.min(failures, 4))));
    };
    void read();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [key, active, visible, nonce, refreshMs]);
  return { ...(state.key === key ? state : { key, data: null, error: null, loading: true, updated: null }), reload: () => reload(n => n + 1) };
}
