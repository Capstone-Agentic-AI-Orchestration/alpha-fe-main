import { useCallback, useEffect, useRef, useState } from 'react';
import { useTabSessionState } from '@/app/AppContext';

/**
 * A text value kept in tab session state without writing it on every keystroke.
 *
 * Tab session state lives in the app-wide context and is saved to localStorage
 * on each change, so writing the chat draft per key re-rendered the whole app
 * and serialised every tab while the person typed. The value is local while
 * typing and saved after a short pause, on key change, and on unmount.
 */
export function useBufferedTabSessionState(key: string, delayMs = 300): [string, (next: string | ((current: string) => string)) => void] {
  const [stored, setStored] = useTabSessionState<string>(key, '');
  const [local, setLocal] = useState(stored);
  const localRef = useRef(stored);
  const writtenRef = useRef(stored);
  const pendingRef = useRef<{ save: (value: string) => void; value: string } | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) { writtenRef.current = pending.value; pending.save(pending.value); }
  }, []);

  // A new key (another conversation) saves what was typed under the old key, then shows the new draft.
  useEffect(() => {
    localRef.current = stored;
    writtenRef.current = stored;
    setLocal(stored);
    return flush;
    // Runs only on a key change on purpose; changes to `stored` under the same key are handled below.
  }, [key, flush]);

  // Someone else changed the saved draft (a new chat, a prefill from another view): show it.
  useEffect(() => {
    if (pendingRef.current || stored === writtenRef.current) return;
    writtenRef.current = stored;
    localRef.current = stored;
    setLocal(stored);
  }, [stored]);

  const setValue = useCallback((next: string | ((current: string) => string)) => {
    const value = typeof next === 'function' ? next(localRef.current) : next;
    localRef.current = value;
    setLocal(value);
    pendingRef.current = { save: setStored, value };
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, delayMs);
  }, [delayMs, flush, setStored]);

  return [local, setValue];
}
