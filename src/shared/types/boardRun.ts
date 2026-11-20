import type { IssuePriority } from './index';

export type BoardRunStatus = 'running' | 'waiting_on_you' | 'paused' | 'stopped' | 'completed';
export type BoardRunTaskState = 'queued' | 'held' | 'planning' | 'working' | 'waiting_on_you' | 'done' | 'stopped';

/** One board task in a run, in the order the run works through them. */
export interface BoardRunTask {
  issueId: string;
  identifier: string;
  title: string;
  priority: IssuePriority;
  state: BoardRunTaskState;
  requestId?: string;
  orchestrationRunId?: string;
  reason?: string;
}

/** A developer's board run: chosen tasks, one after another, from a project chat. */
export interface BoardRun {
  id: string;
  workspaceId: string;
  ownerId: string;
  projectId: string;
  threadId: string;
  status: BoardRunStatus;
  tasks: BoardRunTask[];
  maxTasks: number;
  maxTokens: number | null;
  maxCostUsd: number | null;
  preApprovePlans: boolean;
  usage: { tokens: number; costUsd: number; unmeasuredBuilds: number };
  reason?: string;
  events: Array<{ at: string; message: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface StartBoardRunBody {
  threadId: string;
  issueIds: string[];
  maxTasks: number;
  maxTokens: number | null;
  maxCostUsd: number | null;
  preApprovePlans: boolean;
}
