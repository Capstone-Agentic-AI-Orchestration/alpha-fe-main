import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    updateIssue: vi.fn(),
    addIssueComment: vi.fn(),
    can: () => true,
    identity: { login: 'maya-reyes', name: 'Maya Reyes' },
    currentUser: { name: 'Maya Reyes' },
    projects: [{ id: 'p1', name: 'Website refresh', key: 'WEB' }]
  }),
  useTabSessionState: <T,>(_key: string, initial: T) => [initial, () => undefined]
}));
vi.mock('@/features/runs/AgentRunProgress', () => ({ AgentRunProgress: () => null }));

import { TaskDetailDrawer } from './TaskDetailDrawer';

const issue = (status: Issue['status']): Issue => ({
  id: 'i1', identifier: 'WEB-19', title: 'Homepage hero redesign', description: 'Use the darker photo.', status,
  priority: 'medium', projectId: 'p1', labels: ['frontend'], comments: [], createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z',
  subtasks: [{ id: 's1', title: 'Shorten the headline', completed: true }, { id: 's2', title: 'Swap the photo', completed: false }]
});

const render = (status: Issue['status'], handOff: boolean) => renderToStaticMarkup(
  <TaskDetailDrawer
    issue={issue(status)}
    sessionPrefix="issues"
    buildActive={false}
    canStartBuild
    onClose={() => undefined}
    onRequestStatus={() => undefined}
    onPlanBuild={() => undefined}
    onHandOff={handOff ? () => undefined : undefined}
  />
);

describe('Task details', () => {
  it('shows the status track, properties and tabs', () => {
    const html = render('todo', false);
    for (const shown of ['WEB-19', 'Backlog', 'In review', 'Priority', 'Assignee', 'Overview', 'Activity', 'Build', '1 of 2', 'Leave a comment']) {
      expect(html).toContain(shown);
    }
    expect(html).not.toContain('Live Build Room');
  });

  it('hands a task to chat for developers', () => {
    const html = render('todo', true);
    expect(html).toContain('Pick this up in chat');
    expect(html).toContain('Work on this in chat');
  });

  it('offers project managers a build plan instead', () => {
    const html = render('todo', false);
    expect(html).toContain('Plan a build');
    expect(html).not.toContain('Work on this in chat');
  });

  it('lets a manager finish or return reviewed work', () => {
    const html = render('review', false);
    expect(html).toContain('Mark done');
    expect(html).toContain('Request changes');
  });
});
