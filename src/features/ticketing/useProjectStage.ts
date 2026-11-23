import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageResult, StageSummary } from './projectStages';

const REFRESH_MS = 30_000;
const errorText = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const status = (error: unknown): number | null =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status: unknown }).status === 'number'
    ? (error as { status: number }).status : null;

/**
 * Loads a project's stage, refreshes it every 30 seconds while the page is
 * visible, and runs stage writes. A 404 means this server has no stages yet:
 * `available` turns false and the page shows nothing stage-related.
 */
export function useProjectStage(load: (() => Promise<StageSummary>) | null, onWritten?: () => void) {
  const [summary, setSummary] = useState<StageSummary | null>(null);
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const token = useRef(0);
  const reload = useCallback(async (quiet = false) => {
    if (!load) return;
    token.current += 1;
    const current = token.current;
    if (!quiet) { setSummary(null); setError(''); }
    try {
      const next = await load();
      if (current !== token.current) return;
      setSummary(next); setAvailable(true); setError('');
    } catch (error_) {
      if (current !== token.current) return;
      if (status(error_) === 404) { setAvailable(false); return; }
      if (!quiet) setError(errorText(error_, 'The project stage could not be loaded. Refresh to try again.'));
    }
  }, [load]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(true); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  /** Runs one write; true when it went through. The new stage arrives with the result, then the conversation refreshes. */
  const run = useCallback(async (work: () => Promise<StageResult | StageSummary>, fallback: string): Promise<boolean> => {
    setBusy(true); setActionError('');
    try {
      const result = await work();
      token.current += 1;
      setSummary('receipt' in result ? result.stage : result);
      onWritten?.();
      return true;
    } catch (error_) {
      setActionError(errorText(error_, fallback));
      // Someone else may have moved the stage on; show what is true now.
      if (status(error_) === 409) void reload(true);
      return false;
    } finally { setBusy(false); }
  }, [onWritten, reload]);

  return { summary, error, available, busy, actionError, setActionError, reload, run };
}
