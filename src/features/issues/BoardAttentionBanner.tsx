import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Issue } from '@/shared/types';
import type { IssueBuildStatus } from '@/shared/services/apiService';

/** Builds waiting on a person. Each one also holds its project's repositories, so new builds wait. */
const DECISIONS: Record<string, string> = {
  awaiting_plan_approval: 'plan approval',
  awaiting_approval: 'final review',
  blocked: 'a recovery decision',
  recovery_required: 'a recovery decision',
  paused: 'someone to resume or stop it'
};

const STUCK_AFTER_MS = 24 * 60 * 60 * 1000;

export type BoardAttentionItem =
  | { kind: 'stuck_build'; issue: Issue; decision: string; waitingMs: number }
  | { kind: 'stale_in_progress'; issue: Issue };

/**
 * What on this board needs a person, computed from data the board already has
 * (no extra requests): builds that have waited more than a day for a decision,
 * and cards still In progress although their last build was cancelled.
 */
export function boardAttention(issues: Issue[], builds: Record<string, IssueBuildStatus>, now = Date.now()): BoardAttentionItem[] {
  const items: BoardAttentionItem[] = [];
  for (const issue of issues) {
    const build = builds[issue.id];
    if (!build) continue;
    const decision = DECISIONS[build.status];
    const updated = Date.parse(build.updatedAt);
    if (decision && Number.isFinite(updated) && now - updated >= STUCK_AFTER_MS) {
      items.push({ kind: 'stuck_build', issue, decision, waitingMs: now - updated });
    } else if (build.status === 'cancelled' && issue.status === 'in_progress') {
      items.push({ kind: 'stale_in_progress', issue });
    }
  }
  return items.sort((a, b) => (b.kind === 'stuck_build' ? b.waitingMs : 0) - (a.kind === 'stuck_build' ? a.waitingMs : 0));
}

export function waitedLabel(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return days === 1 ? '1 day' : `${days} days`;
  const hours = Math.max(1, Math.floor(ms / (60 * 60 * 1000)));
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

export const BoardAttentionBanner: React.FC<{
  items: BoardAttentionItem[];
  canManageIssues: boolean;
  onOpenIssue: (issueId: string) => void;
  onMoveToTodo: (issueId: string) => void;
}> = ({ items, canManageIssues, onOpenIssue, onMoveToTodo }) => {
  if (!items.length) return null;
  const stuck = items.filter((item): item is Extract<BoardAttentionItem, { kind: 'stuck_build' }> => item.kind === 'stuck_build');
  const stale = items.filter(item => item.kind === 'stale_in_progress');
  return (
    <div role="status" className="rounded-lg border border-status-warning-border bg-status-warning-subtle px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center gap-1.5 font-medium text-content">
        <AlertTriangle className="w-3.5 h-3.5 text-status-warning" aria-hidden="true" />
        Needs a decision
      </div>
      {stuck.map(item => (
        <div key={item.issue.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-content-secondary">
          <span>
            <span className="font-mono text-content">{item.issue.identifier}</span> has waited {waitedLabel(item.waitingMs)} for {item.decision}.
            New builds in this project wait until it is resolved.
          </span>
          <button type="button" onClick={() => onOpenIssue(item.issue.id)} className="font-medium text-selected-content hover:underline">Open</button>
        </div>
      ))}
      {stale.map(item => (
        <div key={item.issue.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-content-secondary">
          <span>
            <span className="font-mono text-content">{item.issue.identifier}</span> is still In progress, but its build was cancelled.
          </span>
          <button type="button" onClick={() => onOpenIssue(item.issue.id)} className="font-medium text-selected-content hover:underline">Open</button>
          {canManageIssues && (
            <button type="button" onClick={() => onMoveToTodo(item.issue.id)} className="font-medium text-selected-content hover:underline">Move to Todo</button>
          )}
        </div>
      ))}
    </div>
  );
};

