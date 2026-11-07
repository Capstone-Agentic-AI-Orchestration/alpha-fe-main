import React from 'react';
import { Bot, Check, RotateCcw, X } from 'lucide-react';
import type { BoardAgentChange } from '@/shared/types';
import { byWhom, canUndo, changeDetails, isMine, timeAgo } from './agentChanges';

const STATUS_TEXT: Record<BoardAgentChange['status'], string> = {
  applied: 'Done',
  held: 'Waiting for confirmation',
  rejected: 'Rejected',
  expired: 'Expired, not made',
  undone: 'Undone',
  failed: 'Not made'
};

/**
 * Agent changes, newest first. The developer an agent acted for can confirm
 * or reject what is waiting and undo what was done; everyone else sees the
 * same list read-only.
 */
export const AgentChangesList: React.FC<{
  changes: BoardAgentChange[];
  login?: string;
  busyId?: string | null;
  now?: number;
  showDetails?: boolean;
  emptyText?: string;
  onDecide?: (id: string, action: 'approve' | 'reject' | 'undo') => void;
  onOpenIssue?: (issueId: string) => void;
}> = ({ changes, login, busyId, now = Date.now(), showDetails = false, emptyText = 'No agent changes yet.', onDecide, onOpenIssue }) => {
  if (!changes.length) return <p className="px-3 py-4 text-xs text-content-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-divider" aria-label="Agent changes">
      {changes.map(change => {
        const mine = isMine(change, login);
        const held = change.status === 'held';
        return (
          <li key={change.id} className={'px-3 py-2.5 text-xs space-y-1 ' + (held ? 'bg-status-warning-subtle' : '')}>
            <div className="flex items-start gap-2">
              <Bot className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-content-secondary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {change.issueId && onOpenIssue ? (
                  <button type="button" onClick={() => onOpenIssue(change.issueId!)} className="text-left font-medium text-content hover:underline">{change.summary}</button>
                ) : (
                  <span className="font-medium text-content">{change.summary}</span>
                )}
                <div className="text-[11px] text-content-muted">
                  {byWhom(change)} · {timeAgo(change.createdAt, now)} · <span className={held ? 'text-status-warning' : ''}>{STATUS_TEXT[change.status]}</span>
                </div>
                {change.reason && change.status !== 'applied' && <div className="text-[11px] text-content-secondary">{change.reason}</div>}
                {showDetails && changeDetails(change).map(row => (
                  <div key={row.field} className="text-[11px] text-content-secondary">
                    <span className="font-mono">{row.field}</span>: {row.before} → {row.after}
                  </div>
                ))}
              </div>
            </div>
            {onDecide && mine && held && (
              <div className="flex items-center gap-3 pl-5">
                <button type="button" disabled={busyId === change.id} onClick={() => onDecide(change.id, 'approve')}
                  className="inline-flex items-center gap-1 rounded-md bg-action px-2 py-1 text-[11px] font-semibold text-on-action hover:bg-action-hover disabled:opacity-50">
                  <Check className="h-3 w-3" aria-hidden="true" /> Confirm
                </button>
                <button type="button" disabled={busyId === change.id} onClick={() => onDecide(change.id, 'reject')}
                  className="inline-flex items-center gap-1 text-[11px] text-content-secondary hover:text-content disabled:opacity-50">
                  <X className="h-3 w-3" aria-hidden="true" /> Reject
                </button>
              </div>
            )}
            {onDecide && canUndo(change, login, now) && (
              <div className="pl-5">
                <button type="button" disabled={busyId === change.id} onClick={() => onDecide(change.id, 'undo')}
                  className="inline-flex items-center gap-1 text-[11px] text-content-secondary hover:text-content disabled:opacity-50">
                  <RotateCcw className="h-3 w-3" aria-hidden="true" /> Undo
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

