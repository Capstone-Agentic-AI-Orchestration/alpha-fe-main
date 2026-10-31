import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Agent, Issue, Project } from '@/shared/types';
import type { BoardBootstrap, BoardChangePage, BoardCursor, BoardState } from '@/shared/types/boardSync';
import { apiService } from './apiService';
import { applyBoardChangePage, catchUpBoard, cursorStorageKey, loadCachedBoard } from './boardSync';

const workspaceId = 'workspace-board-sync';
const cursor = (value: string): BoardCursor => ({ workspaceId, value });
const project = (id: string): Project => ({
  id, name: id, key: id.toUpperCase(), description: '', color: '#123456', icon: 'box',
  status: 'in_progress', targetDate: '', resources: []
} as Project);
const agent = (id: string): Agent => ({ id, name: id } as Agent);
const issue = (id: string, projectId = 'project-1'): Issue => ({
  id, identifier: id, title: id, description: '', status: 'todo', priority: 'medium',
  projectId, labels: [], subtasks: [], comments: [], createdAt: '', updatedAt: ''
});
const state: BoardState = { projects: [], agents: [], issues: [] };
const bootstrap: BoardBootstrap = {
  workspaceId,
  cursor: cursor('5'),
  projects: [project('project-1')],
  agents: [agent('agent-1')],
  issues: [issue('issue-1')]
};

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => { values.delete(key); },
    setItem: (key: string, value: string) => { values.set(key, String(value)); }
  } as unknown as Storage;
}

let storage: Storage;
beforeEach(() => { storage = memoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const recordKey = `alpha_multica_${cursorStorageKey(workspaceId)}`;
function seedRecord(over: Partial<BoardState & { userId: string; cursor: BoardCursor }> = {}) {
  localStorage.setItem(recordKey, JSON.stringify({
    workspaceId, cursor: cursor('5'), projects: [project('project-1')], agents: [], issues: [], ...over
  }));
}

describe('browser board cursor sync', () => {
  it('bootstraps when there is no cached cursor and saves the snapshot before its cursor', async () => {
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges');

    const result = await catchUpBoard(workspaceId);

    expect(bootstrapSpy).toHaveBeenCalledOnce();
    expect(changesSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ state: { projects: bootstrap.projects, agents: bootstrap.agents, issues: bootstrap.issues }, cursor: cursor('5') });
    expect(loadCachedBoard(workspaceId)).toEqual({
      state: { projects: bootstrap.projects, agents: bootstrap.agents, issues: bootstrap.issues },
      cursor: cursor('5'),
      userId: undefined
    });
  });

  /**
   * The desktop failure this version fixes: another workspace's projects saved
   * under this workspace's key, beside a cursor the server considers current.
   * Delta pages had nothing to replay, so the wrong list stayed forever.
   */
  it('replaces a version-3 cache holding another workspace\u2019s rows with one snapshot', async () => {
    localStorage.setItem(`alpha_multica_board_cursor_v3:${workspaceId}`, JSON.stringify(cursor('5')));
    localStorage.setItem(`alpha_multica_projects:${workspaceId}`, JSON.stringify([project('money-tracker')]));
    vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges');

    const result = await catchUpBoard(workspaceId);

    expect(changesSpy).not.toHaveBeenCalled();
    expect(result.state.projects.map(row => row.id)).toEqual(['project-1']);
    expect(localStorage.getItem(`alpha_multica_projects:${workspaceId}`)).toBeNull();
    expect(localStorage.getItem(`alpha_multica_board_cursor_v3:${workspaceId}`)).toBeNull();

    // Back to deltas afterwards.
    changesSpy.mockResolvedValue({ workspaceId, nextCursor: cursor('5'), hasMore: false, resetRequired: false, changes: [] });
    await catchUpBoard(workspaceId);
    expect(changesSpy).toHaveBeenCalledOnce();
  });

  it('replaces a cache read for another account on a shared machine', async () => {
    seedRecord({ userId: 'LloydLim1', projects: [project('pm-only')] });
    vi.spyOn(apiService, 'getBoardChanges').mockResolvedValue({
      workspaceId, userId: 'Lloyd1020', nextCursor: cursor('5'), hasMore: false, resetRequired: false, changes: []
    });
    vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue({ ...bootstrap, userId: 'Lloyd1020' });

    const result = await catchUpBoard(workspaceId);

    expect(result.state.projects.map(row => row.id)).toEqual(['project-1']);
    expect(loadCachedBoard(workspaceId).userId).toBe('Lloyd1020');
  });

  it('uses only delta pages when a valid cursor exists', async () => {
    const previous = cursor('5');
    seedRecord({ cursor: previous });
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap');
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges').mockResolvedValue({
      workspaceId, nextCursor: cursor('6'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '6', table: 'projects', rowKey: { id: 'project-2' }, operation: 'insert', row: project('project-2') as unknown as Record<string, unknown> }]
    });

    const result = await catchUpBoard(workspaceId);

    expect(bootstrapSpy).not.toHaveBeenCalled();
    expect(changesSpy).toHaveBeenCalledExactlyOnceWith(previous, 100);
    expect(result.state.projects.map(row => row.id)).toEqual(['project-1', 'project-2']);
    expect(result.cursor).toEqual(cursor('6'));
    expect(loadCachedBoard(workspaceId).cursor).toEqual(cursor('6'));
  });

  it('replaces an expired cursor with exactly one fresh bootstrap', async () => {
    seedRecord({ cursor: cursor('1') });
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges').mockResolvedValue({
      workspaceId, nextCursor: cursor('9'), hasMore: false, resetRequired: true, changes: []
    });

    const result = await catchUpBoard(workspaceId);

    expect(changesSpy).toHaveBeenCalledOnce();
    expect(bootstrapSpy).toHaveBeenCalledOnce();
    expect(result.cursor).toEqual(cursor('5'));
    expect(result.state).toEqual({ projects: bootstrap.projects, agents: bootstrap.agents, issues: bootstrap.issues });
  });

  it('applies repeated rows idempotently and removes issue and comment delete markers', () => {
    const original = {
      ...state,
      projects: [project('project-1')],
      issues: [{ ...issue('issue-1'), comments: [
        { id: 'comment-1', issueId: 'issue-1', authorType: 'user' as const, authorName: 'A', content: 'one', createdAt: '' },
        { id: 'comment-2', issueId: 'issue-1', authorType: 'user' as const, authorName: 'A', content: 'two', createdAt: '' }
      ] }]
    };
    const duplicate: BoardChangePage = {
      workspaceId, nextCursor: cursor('6'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '6', table: 'projects', rowKey: { id: 'project-2' }, operation: 'insert', row: project('project-2') as unknown as Record<string, unknown> }]
    };
    const once = applyBoardChangePage(original, duplicate);
    const twice = applyBoardChangePage(once, duplicate);
    expect(twice.projects.filter(row => row.id === 'project-2')).toHaveLength(1);

    const commentsDeleted = applyBoardChangePage(twice, {
      workspaceId, nextCursor: cursor('7'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '7', table: 'issue_comments', rowKey: { id: 'comment-1' }, operation: 'delete', row: null }]
    });
    expect(commentsDeleted.issues[0].comments.map(comment => comment.id)).toEqual(['comment-2']);

    const commentAdded = applyBoardChangePage(commentsDeleted, {
      workspaceId, nextCursor: cursor('8'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '8', table: 'issue_comments', rowKey: { id: 'comment-3' }, operation: 'insert', row: {
        id: 'comment-3', issueId: 'issue-1', authorType: 'user', authorName: 'B', content: 'three', createdAt: ''
      } }]
    });
    expect(commentAdded.issues[0].comments.map(comment => comment.id)).toEqual(['comment-2', 'comment-3']);

    const issueDeleted = applyBoardChangePage(commentAdded, {
      workspaceId, nextCursor: cursor('9'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '9', table: 'issues', rowKey: { id: 'issue-1' }, operation: 'delete', row: null }]
    });
    expect(issueDeleted.issues).toEqual([]);
  });

  it('keeps the previous cache whole when the combined write fails', () => {
    const previous = cursor('5');
    seedRecord({ cursor: previous });
    const originalSetItem = storage.setItem.bind(storage);
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === recordKey) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem(key, value);
    });

    expect(() => applyBoardChangePage(state, {
      workspaceId, nextCursor: cursor('6'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '6', table: 'projects', rowKey: { id: 'project-2' }, operation: 'insert', row: project('project-2') as unknown as Record<string, unknown> }]
    })).toThrow(/quota exceeded/i);
    expect(loadCachedBoard(workspaceId).cursor).toEqual(previous);
    expect(loadCachedBoard(workspaceId).state.projects.map(row => row.id)).toEqual(['project-1']);
    expect(setItem).toHaveBeenCalled();
  });
});
