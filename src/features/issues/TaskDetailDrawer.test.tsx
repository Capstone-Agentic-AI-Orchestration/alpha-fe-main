import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Issue } from '@/shared/types';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

let currentRole: 'dev' | 'pm' = 'dev';
// Desktop app or hosted web: read on every call, so each test can pick one.
let desktopApp = true;
vi.mock('@/shared/desktop', () => ({ get isDesktop() { return desktopApp; }, desktop: undefined }));
vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    updateIssue: vi.fn(),
    addIssueComment: vi.fn(),
    can: (capability: string) => capability !== 'run_builds' || currentRole !== 'pm',
    role: currentRole,
    identity: { login: 'maya-reyes', name: 'Maya Reyes' },
    currentUser: { name: 'Maya Reyes' },
    projects: [{ id: 'p1', name: 'Website refresh', key: 'WEB' }],
    issues: []
  }),
  useTabSessionState: <T,>(_key: string, initial: T) => [initial, () => undefined]
}));
vi.mock('@/features/runs/AgentRunProgress', () => ({ AgentRunProgress: () => null }));

import { TaskDetailDrawer } from './TaskDetailDrawer';

const issue = (status: Issue['status'], comments: Issue['comments'] = []): Issue => ({
  id: 'i1', identifier: 'WEB-19', title: 'Homepage hero redesign', description: 'Use the darker photo.', status,
  priority: 'medium', projectId: 'p1', labels: ['frontend'], comments, createdAt: '2026-10-21T10:00:00Z', updatedAt: '2026-10-21T10:00:00Z',
  subtasks: [{ id: 's1', title: 'Shorten the headline', completed: true }, { id: 's2', title: 'Swap the photo', completed: false }]
});

const render = (status: Issue['status'], handOff: boolean, canStartBuild = true, { web = false, comments = [] as Issue['comments'] } = {}) => {
  desktopApp = !web;
  return renderToStaticMarkup(<TaskDetailDrawer
    issue={issue(status, comments)}
    sessionPrefix="issues"
    buildActive={false}
    canStartBuild={canStartBuild}
    onClose={() => undefined}
    onRemove={() => undefined}
    onRequestStatus={() => undefined}
    onPlanBuild={() => undefined}
    onHandOff={handOff ? () => undefined : undefined}
  />);
};

describe('Task details', () => {
  it('sits beside the task list instead of covering it, overlaying only on narrow windows', () => {
    const aside = render('todo', false).match(/<aside[^>]*class="([^"]*)"/)?.[1].split(' ') ?? [];
    expect(aside).toEqual(expect.arrayContaining(['relative', 'h-full', 'shrink-0']));
    // Every overlay class is limited to narrow windows.
    expect(aside.filter(name => /^(absolute|fixed|shadow-2xl|z-\d+)$/.test(name))).toEqual([]);
    expect(aside).toEqual(expect.arrayContaining(['max-md:absolute', 'max-md:w-full']));
  });

  it('wraps a long title and lets the description grow, instead of cutting text off or scrolling a small box', () => {
    const html = render('todo', false);
    // The title is a wrapping field, not a one-line input.
    expect(html).toMatch(/<textarea[^>]*id="[^"]*-title"/);
    expect(html).not.toMatch(/<input[^>]*id="[^"]*-title"/);
    const description = html.match(/<textarea[^>]*id="[^"]*-description"[^>]*>/)?.[0] ?? '';
    expect(description).toContain('resize-none');
    expect(description).not.toContain('resize-y');
  });

  it('shows status as a details row, with Overview and Build tabs in the desktop app', () => {
    const html = render('todo', false);
    for (const shown of ['WEB-19', 'Status', 'Backlog', 'In review', 'Priority', 'Assignee', 'Overview', 'Build', 'Comments', 'No comments yet.', 'Archive task WEB-19', '1 of 2', 'Leave a comment']) {
      expect(html).toContain(shown);
    }
    // The board shows where the task is; the drawer has no status track and no Activity tab.
    expect(html).not.toContain('aria-label="Status"');
    expect(html).not.toContain('Activity');
    expect(html).not.toContain('Live Build Room');
  });

  it('shows no build surfaces on the hosted web app, only the task and its comments', () => {
    const html = render('todo', false, true, {
      web: true,
      comments: [{ id: 'c1', authorType: 'user', authorName: 'Ana Cruz', content: 'Client approved the copy.', createdAt: '2026-10-22T09:00:00Z' }],
    });
    for (const shown of ['Status', 'Priority', 'Comments', 'Ana Cruz', 'Client approved the copy.', 'Leave a comment']) expect(html).toContain(shown);
    for (const hidden of ['role="tablist"', '>Build<', 'Build status unavailable', 'Plan build', 'Activity']) expect(html).not.toContain(hidden);
  });

  it('hands a task to chat for developers', () => {
    const html = render('todo', true);
    expect(html).toContain('Pick this up in chat');
    expect(html).toContain('Work on this in chat');
  });

  it('keeps PMs in review mode while developers own build planning', () => {
    currentRole = 'pm';
    try {
      const html = render('todo', false, false);
      expect(html).toContain('A developer will plan and run this task. You can review the resulting work here.');
      expect(html).not.toContain('Plan a build');
    } finally {
      currentRole = 'dev';
    }
  });

  it('lets a manager finish or return reviewed work', () => {
    const html = render('review', false);
    expect(html).toContain('Mark done');
    expect(html).toContain('Request revisions');
  });

  it('shows a task held by a finished build as In review, read-only, without Alpha labels', () => {
    desktopApp = true;
    const html = renderToStaticMarkup(<TaskDetailDrawer
      issue={{ ...issue('todo'), labels: ['alpha:chat-build', 'frontend'] }}
      sessionPrefix="issues"
      build={{ issueId: 'i1', projectId: 'p1', runId: 'run-1', status: 'awaiting_approval', updatedAt: '' }}
      buildActive
      canStartBuild={false}
      onClose={() => undefined}
      onRemove={() => undefined}
      onRequestStatus={() => undefined}
      onPlanBuild={() => undefined}
    />);
    expect(html).toContain('Ready for your review');
    expect(html).toContain('Follows the build');
    expect(html).toMatch(/In review<span[^>]*>Follows the build/);
    expect(html).not.toMatch(/<select[^>]*id="[^"]*-status"/);
    expect(html).toContain('frontend');
    expect(html).not.toContain('alpha:chat-build');
  });

  it('folds dates and dependencies into one Schedule row', () => {
    const html = render('todo', false);
    expect(html).toContain('Schedule');
    expect(html).toContain('Not scheduled');
    expect(html).not.toContain('Planned start');
    expect(html).not.toContain('Select tasks that need to finish');
  });

  it('keeps status-driven next steps on the hosted web app', () => {
    const html = render('review', false, true, { web: true });
    expect(html).toContain('Mark done');
    expect(html).toContain('Request revisions');
  });
});
