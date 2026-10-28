import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Agent, Issue, Project } from '@/shared/types';
import { loadFromStorage } from '@/shared/lib/storage';
import type { BoardBootstrap, BoardChangePage, BoardCursor, BoardState } from '@/shared/types/boardSync';
import { apiService } from './apiService';
import { applyBoardChangePage, catchUpBoard, cursorStorageKey } from './boardSync';

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

describe('browser board cursor sync', () => {
  it('bootstraps when there is no cached cursor and saves the snapshot before its cursor', async () => {
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges');

    const result = await catchUpBoard(workspaceId, null);

    expect(bootstrapSpy).toHaveBeenCalledOnce();
    expect(changesSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ state: { projects: bootstrap.projects, agents: bootstrap.agents, issues: bootstrap.issues }, cursor: cursor('5') });
    expect(loadFromStorage(`projects:${workspaceId}`, [])).toEqual(bootstrap.projects);
    expect(loadFromStorage(cursorStorageKey(workspaceId), null)).toEqual(cursor('5'));
  });

  it('replaces a legacy persona cache even when its previous cursor was current', async () => {
    localStorage.setItem(`alpha_multica_board_cursor_v2:${workspaceId}`, JSON.stringify(cursor('5')));
    localStorage.setItem(`alpha_multica_agents:${workspaceId}`, JSON.stringify([
      { ...agent('agent-orion'), name: 'Orion Cross' }
    ]));
    vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges');

    const result = await catchUpBoard(workspaceId, loadFromStorage(cursorStorageKey(workspaceId), null));

    expect(changesSpy).not.toHaveBeenCalled();
    expect(result.state.agents).toEqual(bootstrap.agents);
    expect(loadFromStorage(`agents:${workspaceId}`, [])).toEqual(bootstrap.agents);
  });

  it('uses only delta pages when a valid cursor exists', async () => {
    const previous = cursor('5');
    localStorage.setItem(`alpha_multica_projects:${workspaceId}`, JSON.stringify([project('project-1')]));
    localStorage.setItem(`alpha_multica_agents:${workspaceId}`, JSON.stringify([]));
    localStorage.setItem(`alpha_multica_issues:${workspaceId}`, JSON.stringify([]));
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap');
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges').mockResolvedValue({
      workspaceId, nextCursor: cursor('6'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '6', table: 'projects', rowKey: { id: 'project-2' }, operation: 'insert', row: project('project-2') as unknown as Record<string, unknown> }]
    });

    const result = await catchUpBoard(workspaceId, previous);

    expect(bootstrapSpy).not.toHaveBeenCalled();
    expect(changesSpy).toHaveBeenCalledExactlyOnceWith(previous, 100);
    expect(result.state.projects.map(row => row.id)).toEqual(['project-1', 'project-2']);
    expect(result.cursor).toEqual(cursor('6'));
  });

  it('replaces an expired cursor with exactly one fresh bootstrap', async () => {
    const bootstrapSpy = vi.spyOn(apiService, 'getBoardBootstrap').mockResolvedValue(bootstrap);
    const changesSpy = vi.spyOn(apiService, 'getBoardChanges').mockResolvedValue({
      workspaceId, nextCursor: cursor('9'), hasMore: false, resetRequired: true, changes: []
    });

    const result = await catchUpBoard(workspaceId, cursor('1'));

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

  it('does not save the next cursor when a board-array storage write fails', () => {
    const previous = cursor('5');
    localStorage.setItem(`alpha_multica_${cursorStorageKey(workspaceId)}`, JSON.stringify(previous));
    const originalSetItem = storage.setItem.bind(storage);
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === `alpha_multica_projects:${workspaceId}`) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return originalSetItem(key, value);
    });

    expect(() => applyBoardChangePage(state, {
      workspaceId, nextCursor: cursor('6'), hasMore: false, resetRequired: false,
      changes: [{ cursor: '6', table: 'projects', rowKey: { id: 'project-2' }, operation: 'insert', row: project('project-2') as unknown as Record<string, unknown> }]
    })).toThrow(/quota exceeded/i);
    expect(loadFromStorage(cursorStorageKey(workspaceId), null)).toEqual(previous);
    expect(setItem).toHaveBeenCalled();
  });
});
