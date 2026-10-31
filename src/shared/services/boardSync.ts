import type { Agent, Issue, IssueComment, Project } from '@/shared/types';
import { loadFromStorage, removeFromStorage, saveToStorageStrict } from '@/shared/lib/storage';
import type {
  BoardBootstrap,
  BoardChange,
  BoardChangePage,
  BoardCursor,
  BoardState,
  BoardSyncResult
} from '@/shared/types/boardSync';
import { apiService } from './apiService';

const PAGE_SIZE = 100;

function validCursor(cursor: BoardCursor | null | undefined, workspaceId: string): cursor is BoardCursor {
  return Boolean(cursor && cursor.workspaceId === workspaceId && /^(0|[1-9]\d*)$/.test(cursor.value));
}

function compareCursor(left: string, right: string): number {
  if (left.length !== right.length) return left.length - right.length;
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Where a workspace's cached board is kept: projects, agents, issues and the
 * cursor in one record, written in one step by this module only.
 *
 * Version 3 kept the arrays and the cursor under separate keys, and the app
 * also saved the arrays whenever the selected workspace changed. When those
 * disagreed -- another workspace's arrays under this workspace's key, with a
 * current cursor -- delta sync had nothing to replay and the wrong list stayed
 * forever. Version 4 starts every device with one authoritative snapshot.
 */
export function cursorStorageKey(workspaceId: string): string {
  return `board_v4:${workspaceId}`;
}

/** One workspace's cached board, as one unit. */
interface BoardCacheRecord extends BoardState {
  workspaceId: string;
  /** The login the server read this board for; absent from older servers. */
  userId?: string;
  cursor: BoardCursor;
}

function readRecord(workspaceId: string): BoardCacheRecord | null {
  const record = loadFromStorage<BoardCacheRecord | null>(cursorStorageKey(workspaceId), null);
  if (!record || typeof record !== 'object' || record.workspaceId !== workspaceId
    || !validCursor(record.cursor, workspaceId)
    || !Array.isArray(record.projects) || !Array.isArray(record.agents) || !Array.isArray(record.issues)) {
    return null;
  }
  return record;
}

/** Older per-array keys; removed so nothing can read a stale copy of them. */
function removeLegacyKeys(workspaceId: string): void {
  for (const key of [`projects:${workspaceId}`, `agents:${workspaceId}`, `issues:${workspaceId}`, `board_cursor_v3:${workspaceId}`]) {
    removeFromStorage(key);
  }
}

function writeRecord(record: BoardCacheRecord): void {
  // One write: the cursor can never be saved without the rows it covers.
  saveToStorageStrict(cursorStorageKey(record.workspaceId), record);
  removeLegacyKeys(record.workspaceId);
}

/** The cached board for a workspace, for showing something before the first sync. */
export function loadCachedBoard(workspaceId: string | null): {
  state: BoardState;
  cursor: BoardCursor | null;
  userId?: string;
} {
  const record = workspaceId ? readRecord(workspaceId) : null;
  if (!record) return { state: { projects: [], agents: [], issues: [] }, cursor: null };
  return {
    state: { projects: record.projects, agents: record.agents, issues: record.issues },
    cursor: record.cursor,
    userId: record.userId
  };
}

function persistBootstrap(bootstrap: BoardBootstrap): BoardSyncResult {
  if (bootstrap.workspaceId !== bootstrap.cursor.workspaceId
    || !/^(0|[1-9]\d*)$/.test(bootstrap.cursor.value)
    || !Array.isArray(bootstrap.projects)
    || !Array.isArray(bootstrap.agents)
    || !Array.isArray(bootstrap.issues)) {
    throw new Error('The board bootstrap response is invalid.');
  }
  const state: BoardState = {
    projects: bootstrap.projects,
    agents: bootstrap.agents,
    issues: bootstrap.issues
  };
  writeRecord({ ...state, workspaceId: bootstrap.workspaceId, userId: bootstrap.userId, cursor: bootstrap.cursor });
  return { state, cursor: bootstrap.cursor };
}

function getRowId(change: BoardChange): string | undefined {
  const value = change.rowKey.id ?? change.row?.id;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex(item => item.id === row.id);
  if (index < 0) return [...rows, row];
  const next = rows.slice();
  next[index] = { ...next[index], ...row };
  return next;
}

function applyIssueChange(issues: Issue[], change: BoardChange): Issue[] {
  const id = getRowId(change);
  if (!id) return issues;
  if (change.operation === 'delete') return issues.filter(issue => issue.id !== id);
  if (!change.row) return issues;
  const current = issues.find(issue => issue.id === id);
  const row = change.row as unknown as Issue;
  return upsert(issues, {
    ...current,
    ...row,
    id,
    // Issue delta rows omit the nested comments array. Keep the cached copy;
    // comment changes arrive as their own cursor entries.
    comments: Array.isArray(change.row.comments) ? row.comments : current?.comments ?? []
  } as Issue);
}

function issueIdFromComment(change: BoardChange): string | undefined {
  const row = change.row;
  const id = row?.issueId ?? row?.issue_id ?? change.rowKey.issue_id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function applyCommentChange(issues: Issue[], change: BoardChange): Issue[] {
  const commentId = getRowId(change);
  if (!commentId) return issues;
  const issueId = issueIdFromComment(change);

  if (change.operation === 'delete') {
    let changed = false;
    const next = issues.map(issue => {
      if (issueId && issue.id !== issueId) return issue;
      const comments = issue.comments.filter(comment => comment.id !== commentId);
      if (comments.length === issue.comments.length) return issue;
      changed = true;
      return { ...issue, comments };
    });
    return changed ? next : issues;
  }

  if (!change.row) return issues;
  const existingIssueId = issues.find(issue => issue.comments.some(comment => comment.id === commentId))?.id;
  const targetIssueId = issueId ?? existingIssueId;
  if (!targetIssueId) return issues;
  const comment = { ...change.row, id: commentId } as unknown as IssueComment;
  let changed = false;
  const next = issues.map(issue => {
    const comments = issue.comments.filter(current => current.id !== commentId);
    if (issue.id !== targetIssueId) {
      if (comments.length === issue.comments.length) return issue;
      changed = true;
      return { ...issue, comments };
    }
    changed = true;
    return { ...issue, comments: [...comments, comment] };
  });
  return changed ? next : issues;
}

/** Apply one page idempotently, persisting changed arrays before acknowledging its cursor. */
export function applyBoardChangePage(state: BoardState, page: BoardChangePage): BoardState {
  if (page.resetRequired) return state;
  if (page.workspaceId !== page.nextCursor.workspaceId
    || !/^(0|[1-9]\d*)$/.test(page.nextCursor.value)) {
    throw new Error('The board change page does not match a valid workspace cursor.');
  }
  const current = readRecord(page.workspaceId);
  if (current && compareCursor(page.nextCursor.value, current.cursor.value) < 0) {
    throw new Error('The board change cursor cannot move backwards.');
  }

  let next: BoardState = state;
  for (const change of page.changes) {
    switch (change.table) {
      case 'projects': {
        const id = getRowId(change);
        if (!id) break;
        next = {
          ...next,
          projects: change.operation === 'delete'
            ? next.projects.filter(project => project.id !== id)
            : change.row
              ? upsert(next.projects, { ...(change.row as unknown as Project), id })
              : next.projects
        };
        break;
      }
      case 'agents': {
        const id = getRowId(change);
        if (!id) break;
        next = {
          ...next,
          agents: change.operation === 'delete'
            ? next.agents.filter(agent => agent.id !== id)
            : change.row
              ? upsert(next.agents, { ...(change.row as unknown as Agent), id })
              : next.agents
        };
        break;
      }
      case 'issues':
        next = { ...next, issues: applyIssueChange(next.issues, change) };
        break;
      case 'issue_comments':
        next = { ...next, issues: applyCommentChange(next.issues, change) };
        break;
      default:
        // Squads and workspace bindings are not represented in browser board state.
        break;
    }
  }
  writeRecord({
    ...next,
    workspaceId: page.workspaceId,
    userId: page.userId ?? current?.userId,
    cursor: page.nextCursor
  });
  return next;
}

async function bootstrapBoard(workspaceId: string): Promise<BoardSyncResult> {
  const bootstrap = await apiService.getBoardBootstrap();
  if (bootstrap.workspaceId !== workspaceId) throw new Error('The board bootstrap belongs to another workspace.');
  return persistBootstrap(bootstrap);
}

/**
 * Bring a workspace's cached board up to date with delta pages, or replace it
 * with one snapshot when there is no usable cache, the server says the history
 * expired, or the cache was read for a different account.
 */
export async function catchUpBoard(workspaceId: string): Promise<BoardSyncResult> {
  if (!workspaceId.trim()) throw new Error('A workspace is required to sync the board.');
  const record = readRecord(workspaceId);
  if (!record) return bootstrapBoard(workspaceId);
  let currentState: BoardState = { projects: record.projects, agents: record.agents, issues: record.issues };
  let currentCursor: BoardCursor = record.cursor;

  while (true) {
    const page = await apiService.getBoardChanges(currentCursor, PAGE_SIZE);
    if (page.workspaceId !== workspaceId || page.nextCursor.workspaceId !== workspaceId) {
      throw new Error('The board change page belongs to another workspace.');
    }
    // Another account's cache on a shared machine: deltas cannot remove rows
    // this account may not see, so start from this account's snapshot.
    const accountChanged = Boolean(page.userId && record.userId && page.userId !== record.userId);
    if (page.resetRequired || accountChanged) return bootstrapBoard(workspaceId);
    const previousCursor = currentCursor;
    currentState = applyBoardChangePage(currentState, page);
    currentCursor = page.nextCursor;
    if (!page.hasMore) break;
    if (compareCursor(currentCursor.value, previousCursor.value) <= 0) {
      throw new Error('The board change page did not advance its cursor.');
    }
  }

  return { state: currentState, cursor: currentCursor };
}
