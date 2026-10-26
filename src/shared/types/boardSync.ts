import type { Agent, Issue, Project } from './index';

export type BoardTable =
  | 'projects' | 'issues' | 'issue_comments' | 'agents' | 'squads'
  | 'workspace_squad_owners' | 'workspace_squad_projects' | 'workspace_project_assignments';

export interface BoardCursor {
  workspaceId: string;
  /** PostgreSQL bigint sent as decimal text so it remains exact in JavaScript. */
  value: string;
}

export interface BoardChange {
  cursor: string;
  table: BoardTable;
  rowKey: Record<string, string>;
  operation: 'insert' | 'update' | 'delete';
  row: Record<string, unknown> | null;
}

export interface BoardChangeLogRow {
  cursor: string;
  table: BoardTable;
  rowKey: Record<string, string>;
  operation: 'insert' | 'update' | 'delete';
  createdAt: string;
}

export interface BoardChangeLogPage {
  rows: BoardChangeLogRow[];
  hasMore: boolean;
  oldestCursor: string | null;
  currentCursor: string;
}

export interface BoardState {
  projects: Project[];
  agents: Agent[];
  issues: Issue[];
}

export interface BoardSyncResult {
  state: BoardState;
  cursor: BoardCursor;
}

export interface BoardChangePage {
  workspaceId: string;
  nextCursor: BoardCursor;
  hasMore: boolean;
  resetRequired: boolean;
  changes: BoardChange[];
}

export interface BoardBootstrap extends BoardState {
  workspaceId: string;
  cursor: BoardCursor;
}
