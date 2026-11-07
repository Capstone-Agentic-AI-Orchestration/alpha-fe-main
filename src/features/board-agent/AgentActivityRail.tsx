import React, { useEffect, useState } from 'react';
import { Bot, X } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { BoardAgentChange, BoardAssistantSettings } from '@/shared/types';
import { AgentChangesList } from './AgentChangesList';

/**
 * What agents did on this board and what waits for a decision. Everyone who
 * can see the board sees it; only the developer an agent acted for decides.
 * Admins and project managers can switch the board assistant off here.
 */
export const AgentActivityRail: React.FC<{
  projectId: string;
  changes: BoardAgentChange[];
  login?: string;
  busyId?: string | null;
  error?: string | null;
  onDecide: (id: string, action: 'approve' | 'reject' | 'undo') => void;
  onOpenIssue: (issueId: string) => void;
  onClose: () => void;
}> = ({ projectId, changes, login, busyId, error, onDecide, onOpenIssue, onClose }) => {
  const [settings, setSettings] = useState<BoardAssistantSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiService.getBoardAssistantSettings(projectId).then(value => { if (!cancelled) setSettings(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectId]);

  const toggle = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await apiService.setBoardAssistantEnabled(projectId, !settings.enabled);
      setSettings({ ...settings, enabled: next.enabled });
    } finally {
      setSaving(false);
    }
  };

  const waiting = changes.filter(change => change.status === 'held');
  const rest = changes.filter(change => change.status !== 'held');
  return (
    <aside aria-label="Agent activity" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-divider bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
        <Bot className="h-4 w-4 text-content-secondary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-content">Agent activity</h2>
        <button type="button" onClick={onClose} aria-label="Close agent activity" className="ml-auto rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content">
          <X className="h-4 w-4" />
        </button>
      </div>
      {settings && (
        <div className="flex items-center gap-2 border-b border-divider px-4 py-2 text-[11px] text-content-secondary">
          <span>Board assistant: <span className="font-medium text-content">{settings.enabled ? 'On' : 'Off'}</span></span>
          {settings.canChange && (
            <button type="button" disabled={saving} onClick={() => void toggle()} className="ml-auto font-medium text-selected-content hover:underline disabled:opacity-50">
              {settings.enabled ? 'Turn off' : 'Turn on'}
            </button>
          )}
        </div>
      )}
      {settings && !settings.canUse && (
        <p className="border-b border-divider px-4 py-2 text-[11px] text-content-muted">Agents work on the board for developers only. You can see everything they do here.</p>
      )}
      <div className="flex-1 overflow-y-auto">
        {error && <p className="px-4 py-2 text-xs text-status-danger">{error}</p>}
        {waiting.length > 0 && (
          <section aria-label="Waiting for confirmation">
            <h3 className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-status-warning">Waiting for confirmation</h3>
            <AgentChangesList changes={waiting} login={login} busyId={busyId} onDecide={onDecide} onOpenIssue={onOpenIssue} />
          </section>
        )}
        <section aria-label="Recent agent changes">
          <h3 className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Recent</h3>
          <AgentChangesList changes={rest} login={login} busyId={busyId} onDecide={onDecide} onOpenIssue={onOpenIssue} showDetails
            emptyText="No agent has changed this board yet." />
        </section>
      </div>
    </aside>
  );
};

