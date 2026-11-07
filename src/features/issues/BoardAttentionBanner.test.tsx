import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';
import type { IssueBuildStatus } from '@/shared/services/apiService';
import { BoardAttentionBanner, boardAttention, waitedLabel } from './BoardAttentionBanner';

const NOW = Date.parse('2026-11-07T08:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const issue = (id: string, status: Issue['status']) => ({ id, identifier: id.toUpperCase(), status, projectId: 'p', title: id }) as Issue;
const build = (issueId: string, status: string, ageMs: number): IssueBuildStatus =>
  ({ issueId, projectId: 'p', runId: 'r-' + issueId, status, updatedAt: new Date(NOW - ageMs).toISOString() });

describe('boardAttention', () => {
  it('lists builds that have waited more than a day for a decision, longest first', () => {
    const items = boardAttention(
      [issue('tes2-106', 'todo'), issue('cap-102', 'todo'), issue('eco-103', 'todo'), issue('fresh', 'todo')],
      {
        'tes2-106': build('tes2-106', 'awaiting_approval', 14 * DAY),
        'cap-102': build('cap-102', 'blocked', 6 * DAY),
        'eco-103': build('eco-103', 'awaiting_approval', 10 * DAY),
        fresh: build('fresh', 'awaiting_plan_approval', 2 * 60 * 60 * 1000)
      },
      NOW
    );
    expect(items.map(item => item.issue.id)).toEqual(['tes2-106', 'eco-103', 'cap-102']);
    expect(items[2]).toMatchObject({ kind: 'stuck_build', decision: 'a recovery decision' });
  });

  it('lists cards left In progress after their build was cancelled, and ignores running or finished builds', () => {
    const items = boardAttention(
      [issue('mon-104', 'in_progress'), issue('todo-card', 'todo'), issue('busy', 'in_progress')],
      { 'mon-104': build('mon-104', 'cancelled', 20 * DAY), 'todo-card': build('todo-card', 'cancelled', DAY), busy: build('busy', 'executing', DAY) },
      NOW
    );
    expect(items).toEqual([{ kind: 'stale_in_progress', issue: expect.objectContaining({ id: 'mon-104' }) }]);
  });

  it('labels waits in days or hours', () => {
    expect(waitedLabel(14 * DAY)).toBe('14 days');
    expect(waitedLabel(DAY + 1)).toBe('1 day');
    expect(waitedLabel(3 * 60 * 60 * 1000)).toBe('3 hours');
  });
});

describe('BoardAttentionBanner', () => {
  const items = boardAttention([issue('cap-102', 'todo'), issue('mon-104', 'in_progress')],
    { 'cap-102': build('cap-102', 'blocked', 6 * DAY), 'mon-104': build('mon-104', 'cancelled', DAY) }, NOW);

  it('says what is waiting and offers the move only to people who manage tasks', () => {
    const html = renderToStaticMarkup(<BoardAttentionBanner items={items} canManageIssues onOpenIssue={vi.fn()} onMoveToTodo={vi.fn()} />);
    expect(html).toContain('CAP-102');
    expect(html).toContain('has waited 6 days for a recovery decision');
    expect(html).toContain('Move to Todo');
    const readOnly = renderToStaticMarkup(<BoardAttentionBanner items={items} canManageIssues={false} onOpenIssue={vi.fn()} onMoveToTodo={vi.fn()} />);
    expect(readOnly).not.toContain('Move to Todo');
  });

  it('renders nothing when the board needs nothing', () => {
    expect(renderToStaticMarkup(<BoardAttentionBanner items={[]} canManageIssues onOpenIssue={vi.fn()} onMoveToTodo={vi.fn()} />)).toBe('');
  });
});

