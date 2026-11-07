import React from 'react';
import { useApp } from '@/app/AppContext';
import { AgentChangesList } from './AgentChangesList';
import { isMine } from './agentChanges';
import { useBoardAgentChanges } from './useBoardAgentChanges';

/**
 * In a developer's project chat: board changes the Manager Agent is waiting
 * for this developer to confirm, with Confirm and Reject. Nothing shows when
 * nothing waits.
 */
export const BoardChangesWaiting: React.FC<{ projectId: string; working?: boolean }> = ({ projectId, working = false }) => {
  const { identity, refreshBoardState } = useApp();
  const { changes, busyId, error, decide } = useBoardAgentChanges(projectId, { fast: working, onBoardChanged: () => { void refreshBoardState(); } });
  const waiting = changes.filter(change => change.status === 'held' && isMine(change, identity?.login));
  if (!waiting.length) return null;
  return (
    <section aria-label="Board changes waiting for you" className="mx-2 max-h-48 overflow-y-auto rounded-lg border border-status-warning-border bg-surface">
      <p className="px-3 pt-2 text-[11.5px] font-semibold text-status-warning">Board changes waiting for you</p>
      {error && <p className="px-3 text-[11px] text-status-danger">{error}</p>}
      <AgentChangesList changes={waiting} login={identity?.login} busyId={busyId} onDecide={(id, action) => void decide(id, action)} />
    </section>
  );
};

