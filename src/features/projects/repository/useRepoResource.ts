import { useCallback, useEffect, useRef, useState } from 'react';

import { describeRepoError } from './repoFormat';

export interface RepoResource<T> {
  data: T | null;
  /** Ready-to-show sentence, or null. */
  error: string | null;
  loading: boolean;
  reload: () => void;
}

type RepoResult<T> = { key: string; data: T | null; error: string | null };

/** Resolve scope during render, before the next request's effect can run. */
export function repoResourceState<T>(result: RepoResult<T> | null, key: string, enabled: boolean, refreshing: boolean) {
  if (!enabled) return { data: null, error: null, loading: false };
  if (result?.key !== key) return { data: null, error: null, loading: true };
  return { data: result.data, error: refreshing ? null : result.error, loading: refreshing };
}

/**
 * Load one repository read and keep only the answer to the latest request.
 *
 * Switching repository or branch fires a new request while the old one is
 * still in flight; without the sequence check a slow earlier answer could land
 * last and show the wrong branch's files. `fetcher` null means "nothing to ask
 * yet" (no branch chosen), which clears the section rather than erroring.
 */
export function useRepoResource<T>(fetcher: (() => Promise<T>) | null, key: string): RepoResource<T> {
  const [result, setResult] = useState<RepoResult<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const sequence = useRef(0);
  // The fetcher is a fresh closure each render; `key` is what decides a reload.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = fetcher !== null;

  useEffect(() => {
    const current = ++sequence.current;
    const run = fetcherRef.current;
    // A refresh keeps the current answer on screen while it reloads; a new key
    // (another branch, another repository) must not show the old one.
    if (!run) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    run()
      .then(data => {
        if (current !== sequence.current) return;
        setResult({ key, data, error: null });
      })
      .catch(err => {
        if (current !== sequence.current) return;
        setResult({ key, data: null, error: describeRepoError(err) });
      })
      .finally(() => {
        if (current === sequence.current) setLoading(false);
      });
  }, [key, nonce, enabled]);

  // An answer that arrives after unmount must not be applied.
  useEffect(() => () => {
    sequence.current += 1;
  }, []);

  const reload = useCallback(() => setNonce(n => n + 1), []);
  return { ...repoResourceState(result, key, enabled, loading), reload };
}
