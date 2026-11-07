import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

let canRunBuilds = true;
vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    createIssue: vi.fn(),
    projects: [{ id: 'p1', name: 'Website refresh', key: 'WEB' }],
    identity: { login: 'maya-reyes', name: 'Maya Reyes' },
    can: (capability: string) => capability !== 'run_builds' || canRunBuilds
  }),
  useTabSessionState: <T,>(_key: string, initial: T) => [initial, () => undefined]
}));
vi.mock('@/shared/desktop', async () => ({
  ...(await vi.importActual<typeof import('@/shared/desktop')>('@/shared/desktop')),
  isDesktop: true
}));

import { CreateIssueModal } from './CreateIssueModal';

const render = () => renderToStaticMarkup(<CreateIssueModal isOpen onClose={() => undefined} />);

describe('New task dialog', () => {
  it('is one form, with no agent mode and no create-another toggle', () => {
    const html = render();
    for (const shown of ['New task', 'Task title', 'What needs to happen?', 'Description', 'Due date', 'More options', 'Status', 'Priority', 'Assignee', 'Labels', 'Suggest steps with Alpha', 'Create task']) {
      expect(html).toContain(shown);
    }
    for (const gone of ['Create another', 'Switch to', 'Create with agent', 'Deconstruct user prompt', 'Suggest from description', 'Plan a build when it’s created']) {
      expect(html).not.toContain(gone);
    }
  });

  it('offers Alpha step suggestions only to roles that can run builds', () => {
    canRunBuilds = true;
    expect(render()).toContain('Suggest steps with Alpha');
    canRunBuilds = false;
    expect(render()).not.toContain('Suggest steps with Alpha');
    canRunBuilds = true;
  });

  it('explains why creation is disabled until the required title is present', () => {
    const html = render();
    expect(html).toContain('Enter a task name first.');
    expect(html).toContain('disabled:cursor-default');
  });
});
