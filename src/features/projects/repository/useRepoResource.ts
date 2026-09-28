import { useCallback, useEffect, useRef, useState } from 'react';

import { describeRepoError } from './repoFormat';

export interface RepoResource<T> {
  data: T | null;
  /** Ready-to-show sentence, or null. */
  error: string | null;
  loading: boolean;
  reload: () => void;
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
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const sequence = useRef(0);
  // The fetcher is a fresh closure each render; `key` is what decides a reload.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const enabled = fetcher !== null;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    const current = ++sequence.current;
    const run = fetcherRef.current;
    // A refresh keeps the current answer on screen while it reloads; a new key
    // (another branch, another repository) must not show the old one.
    const keyChanged = lastKey.current !== key;
    lastKey.current = key;
    if (!run) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (keyChanged) setData(null);
    setLoading(true);
    setError(null);
    run()
      .then(result => {
        if (current !== sequence.current) return;
        setData(result);
      })
      .catch(err => {
        if (current !== sequence.current) return;
        setData(null);
        setError(describeRepoError(err));
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
  return { data, error, loading, reload };
}
