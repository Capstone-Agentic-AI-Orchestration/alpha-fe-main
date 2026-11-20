import type { Issue, IssuePriority } from '@/shared/types';
import type { BoardRun, BoardRunTaskState } from '@/shared/types/boardRun';

const PRIORITY_RANK: Record<IssuePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/** Open tasks a run can take, highest priority first; To-do tasks are ticked to start with. */
export function runCandidates(issues: Issue[], projectId: string): Array<{ issue: Issue; preselected: boolean }> {
  return issues
    .filter(issue => issue.projectId === projectId && !issue.archivedAt && !['done', 'agent_running', 'review'].includes(issue.status))
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .map(issue => ({ issue, preselected: issue.status === 'todo' }));
}

/** A dependency note for the dialog: what this task waits on, by identifier. */
export function dependencyNote(issue: Issue, issues: Issue[]): string | null {
  const waits = (issue.dependsOnIssueIds ?? [])
    .map(id => issues.find(item => item.id === id))
    .filter((item): item is Issue => Boolean(item) && item!.status !== 'done');
  return waits.length ? `after ${waits.map(item => item.identifier).join(', ')}` : null;
}

const TASK_STATE: Record<BoardRunTaskState, { label: string; tone: 'done' | 'attention' | 'active' | 'quiet' }> = {
  done: { label: 'Done · PR opened', tone: 'done' },
  waiting_on_you: { label: 'Waiting for your approval', tone: 'attention' },
  working: { label: 'Working', tone: 'active' },
  planning: { label: 'Planning', tone: 'active' },
  queued: { label: 'Next', tone: 'quiet' },
  held: { label: 'Held', tone: 'attention' },
  stopped: { label: 'Not started', tone: 'quiet' }
};

export function taskStateLabel(state: BoardRunTaskState) { return TASK_STATE[state]; }

export function runStatusLabel(run: BoardRun): string {
  switch (run.status) {
    case 'running': return 'Running';
    case 'waiting_on_you': return 'Waiting for you';
    case 'paused': return 'Paused';
    case 'stopped': return 'Stopped';
    default: return 'Finished';
  }
}

/** "spent 12,300 tokens of 200,000 · $0.84 of $5.00" */
export function runSpend(run: BoardRun): string {
  const tokenLimit = run.maxTokens ? ' of ' + run.maxTokens.toLocaleString() : '';
  const costLimit = run.maxCostUsd ? ' of $' + run.maxCostUsd.toFixed(2) : '';
  const tokens = `${run.usage.tokens.toLocaleString()}${tokenLimit} tokens`;
  const cost = `$${run.usage.costUsd.toFixed(2)}${costLimit}`;
  return `spent ${tokens} · ${cost}`;
}

/** The message a run card sits under: the last one sent before the run started. */
export function runAnchorId(messages: ReadonlyArray<{ id: string; timestamp: string }>, createdAt: string): string | null {
  const started = Date.parse(createdAt);
  return messages.filter(message => Date.parse(message.timestamp) <= started).at(-1)?.id ?? null;
}

/** Whether a message asks for agents to work through the board, so chat can offer a run. */
export function asksForBoardRun(text: string): boolean {
  return /\b(work|go|run|move)\s+(through|down)\s+(the\s+)?(whole\s+)?(board|backlog|tasks|to-?do( list)?)\b/i.test(text)
    || /\b(board run|do (all|every) (the )?tasks|do the tasks one (by|after) (one|another))\b/i.test(text);
}
