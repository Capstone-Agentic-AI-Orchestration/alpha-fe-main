import { useCallback, useEffect, useState } from 'react';

import { apiService } from '@/shared/services/apiService';
import type { BoardRun } from '@/shared/types/boardRun';

const ACTIVE = ['running', 'waiting_on_you', 'paused'];

/**
 * This developer's board runs in a project, refreshed every 10 seconds while shown,
 * the same pace the desktop moves a run on. Off when the person cannot run builds.
 */
export function useBoardRuns(projectId: string | undefined, enabled: boolean) {
  const [runs, setRuns] = useState<BoardRun[]>([]);
  const refresh = useCallback(async () => {
    if (!projectId || !enabled) return;
    try { setRuns(await apiService.listBoardRuns(projectId)); } catch { /* the card keeps the last state it had */ }
  }, [projectId, enabled]);
  useEffect(() => {
    setRuns([]);
    if (!projectId || !enabled) return undefined;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(timer);
  }, [projectId, enabled, refresh]);
  const active = runs.find(run => ACTIVE.includes(run.status)) ?? null;
  return { runs, active, refresh, setRuns };
}
