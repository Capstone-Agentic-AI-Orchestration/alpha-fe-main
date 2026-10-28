import type { Agent, Issue, IssueComment, Project } from '@/shared/types';
import { loadFromStorage, saveToStorageStrict } from '@/shared/lib/storage';
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
 * Where a workspace's board cursor is kept. Versioned: a cursor only means
 * "the cache holds everything before this point". Earlier caches can still
 * contain retired local personas absent from the shared board: delta pages
 * have no deletion to replay for records that never belonged to that board.
 * Version 3 replaces those caches with one authoritative workspace snapshot.
 */
export function cursorStorageKey(workspaceId: string): string {
  return `board_cursor_v3:${workspaceId}`;
}

function readBoardState(workspaceId: string): BoardState {
  return {
    projects: loadFromStorage<Project[]>(`projects:${workspaceId}`, []),
    agents: loadFromStorage<Agent[]>(`agents:${workspaceId}`, []),
    issues: loadFromStorage<Issue[]>(`issues:${workspaceId}`, [])
  };
}

function persistBoardState(state: BoardState, cursor: BoardCursor, affected: Set<keyof BoardState>): void {
  // The cursor acknowledges everything before it. Save it only after every
  // array affected by this page has been written successfully.
  if (affected.has('projects')) saveToStorageStrict(`projects:${cursor.workspaceId}`, state.projects);
  if (affected.has('agents')) saveToStorageStrict(`agents:${cursor.workspaceId}`, state.agents);
  if (affected.has('issues')) saveToStorageStrict(`issues:${cursor.workspaceId}`, state.issues);
  saveToStorageStrict(cursorStorageKey(cursor.workspaceId), cursor);
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
  persistBoardState(state, bootstrap.cursor, new Set(['projects', 'agents', 'issues']));
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
  const currentCursor = loadFromStorage<BoardCursor | null>(cursorStorageKey(page.workspaceId), null);
  if (validCursor(currentCursor, page.workspaceId)
    && compareCursor(page.nextCursor.value, currentCursor.value) < 0) {
    throw new Error('The board change cursor cannot move backwards.');
  }

  let next: BoardState = state;
  const affected = new Set<keyof BoardState>();
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
        affected.add('projects');
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
        affected.add('agents');
        break;
      }
      case 'issues':
        next = { ...next, issues: applyIssueChange(next.issues, change) };
        affected.add('issues');
        break;
      case 'issue_comments':
        next = { ...next, issues: applyCommentChange(next.issues, change) };
        affected.add('issues');
        break;
      default:
        // Squads and workspace bindings are not represented in browser board state.
        break;
    }
  }
  persistBoardState(next, page.nextCursor, affected);
  return next;
}

/** Read only board-change pages, bootstrapping when this workspace has no usable cursor. */
export async function catchUpBoard(
  workspaceId: string,
  cachedCursor: BoardCursor | null
): Promise<BoardSyncResult> {
  if (!workspaceId.trim()) throw new Error('A workspace is required to sync the board.');
  let currentState = readBoardState(workspaceId);
  let currentCursor = validCursor(cachedCursor, workspaceId) ? cachedCursor : null;

  if (!currentCursor) {
    const bootstrap = await apiService.getBoardBootstrap();
    if (bootstrap.workspaceId !== workspaceId) throw new Error('The board bootstrap belongs to another workspace.');
    return persistBootstrap(bootstrap);
  }

  while (true) {
    const page = await apiService.getBoardChanges(currentCursor, PAGE_SIZE);
    if (page.workspaceId !== workspaceId || page.nextCursor.workspaceId !== workspaceId) {
      throw new Error('The board change page belongs to another workspace.');
    }
    if (page.resetRequired) {
      const bootstrap = await apiService.getBoardBootstrap();
      if (bootstrap.workspaceId !== workspaceId) throw new Error('The board bootstrap belongs to another workspace.');
      return persistBootstrap(bootstrap);
    }
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
