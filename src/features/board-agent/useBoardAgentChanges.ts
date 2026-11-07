import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import type { BoardAgentChange } from '@/shared/types';

/**
 * Agent changes for one project's board, from this desktop's own daemon.
 *
 * Read every 20 seconds, or every 2 while an agent is working on the board
 * (\`fast\`). The change log never leaves this machine, so this costs no cloud
 * traffic; the cards themselves arrive through the board's usual feed.
 */
export function useBoardAgentChanges(projectId: string | null, options: { fast?: boolean; onBoardChanged?: () => void } = {}) {
  const [changes, setChanges] = useState<BoardAgentChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const onBoardChanged = useRef(options.onBoardChanged);
  onBoardChanged.current = options.onBoardChanged;
  const latest = useRef<string>('');

  const load = useCallback(async () => {
    if (!projectId || !isDesktop) return;
    try {
      const rows = await apiService.getBoardAgentChanges(projectId);
      setChanges(rows);
      setError(null);
      // New or newly decided changes mean cards moved: fetch just those.
      const signature = rows.map(row => row.id + ':' + row.status).join('|');
      if (latest.current && signature !== latest.current) onBoardChanged.current?.();
      latest.current = signature;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    latest.current = '';
    setChanges([]);
    void load();
  }, [load]);

  useEffect(() => {
    if (!projectId || !isDesktop) return;
    const timer = window.setInterval(() => void load(), options.fast ? 2_000 : 20_000);
    return () => window.clearInterval(timer);
  }, [load, options.fast, projectId]);

  const decide = useCallback(async (id: string, action: 'approve' | 'reject' | 'undo') => {
    setBusyId(id);
    try {
      if (action === 'approve') await apiService.approveBoardAgentChange(id);
      else if (action === 'reject') await apiService.rejectBoardAgentChange(id);
      else await apiService.undoBoardAgentChange(id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
      await load();
      onBoardChanged.current?.();
    }
  }, [load]);

  return { changes, error, busyId, reload: load, decide };
}

