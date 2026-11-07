import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { BoardAgentChange } from '@/shared/types';
import { canUndo, cardMarks, changeDetails, ghostCards, timeAgo } from './agentChanges';
import { AgentChangesList } from './AgentChangesList';

const NOW = Date.parse('2026-11-07T08:00:00Z');
const change = (over: Partial<BoardAgentChange> = {}): BoardAgentChange => ({
  id: 'bac-1', projectId: 'p', issueId: 'i1', runId: 'turn', agentName: 'Manager Agent', actorUserId: 'lloyd', actorLogin: 'lloyd',
  action: 'move', status: 'applied', summary: 'Moved CAP-1 to Todo', input: { updates: { status: 'todo' } },
  before: { status: 'backlog', updatedAt: 't0', identifier: 'CAP-1' }, after: { status: 'todo', updatedAt: 't1', identifier: 'CAP-1' },
  createdAt: new Date(NOW - 5 * 60 * 1000).toISOString(), ...over
});

describe('agent change helpers', () => {
  it('marks a held change over a recent one, and forgets old changes', () => {
    const marks = cardMarks([
      change({ id: 'held', status: 'held', issueId: 'i1' }),
      change({ id: 'recent', issueId: 'i1' }),
      change({ id: 'recent-2', issueId: 'i2' }),
      change({ id: 'old', issueId: 'i3', createdAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString() })
    ], NOW);
    expect(marks.get('i1')).toMatchObject({ kind: 'held', label: 'Waiting for lloyd to confirm' });
    expect(marks.get('i2')).toMatchObject({ kind: 'recent', label: 'Changed by Manager Agent for lloyd' });
    expect(marks.has('i3')).toBe(false);
  });

  it('shows held creates and moves as dashed cards in the column they would land in', () => {
    expect(ghostCards([
      change({ id: 'c', status: 'held', action: 'create', issueId: undefined, input: { fields: { title: 'Login page', status: 'backlog' } } }),
      change({ id: 'm', status: 'held', input: { updates: { status: 'review' } } }),
      change({ id: 'done', status: 'applied' })
    ])).toEqual([
      expect.objectContaining({ changeId: 'c', column: 'backlog', title: 'Login page' }),
      expect.objectContaining({ changeId: 'm', column: 'review', title: 'CAP-1' })
    ]);
  });

  it('offers Undo only to the developer it acted for, within a day, and never for comments', () => {
    expect(canUndo(change(), 'lloyd', NOW)).toBe(true);
    expect(canUndo(change(), 'maria', NOW)).toBe(false);
    expect(canUndo(change({ action: 'comment' }), 'lloyd', NOW)).toBe(false);
    expect(canUndo(change({ createdAt: new Date(NOW - 25 * 60 * 60 * 1000).toISOString() }), 'lloyd', NOW)).toBe(false);
  });

  it('describes what changed, field by field', () => {
    expect(changeDetails(change())).toEqual([{ field: 'status', before: 'backlog', after: 'todo' }]);
    expect(timeAgo(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now');
  });
});

describe('AgentChangesList', () => {
  const held = change({ id: 'h', status: 'held', summary: 'Archive CAP-2', action: 'archive', reason: 'Archiving waits for lloyd to confirm.' });

  it('lets the developer it acted for confirm, reject or undo', () => {
    const html = renderToStaticMarkup(<AgentChangesList changes={[held, change()]} login="lloyd" now={NOW} onDecide={vi.fn()} />);
    expect(html).toContain('Archive CAP-2');
    expect(html).toContain('Manager Agent for lloyd');
    expect(html).toContain('Confirm');
    expect(html).toContain('Reject');
    expect(html).toContain('Undo');
  });

  it('is read-only for anyone else, such as a project manager', () => {
    const html = renderToStaticMarkup(<AgentChangesList changes={[held, change()]} login="maria" now={NOW} onDecide={vi.fn()} />);
    expect(html).toContain('Waiting for confirmation');
    expect(html).not.toContain('Confirm</button>');
    expect(html).not.toContain('Undo');
  });

  it('shows before and after values when asked', () => {
    const html = renderToStaticMarkup(<AgentChangesList changes={[change()]} login="lloyd" now={NOW} showDetails />);
    expect(html).toContain('backlog → todo');
  });
});

