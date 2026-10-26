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

import { CreateIssueModal } from './CreateIssueModal';

const render = () => renderToStaticMarkup(<CreateIssueModal isOpen onClose={() => undefined} />);

describe('New task dialog', () => {
  it('is one form, with no agent mode and no create-another toggle', () => {
    const html = render();
    for (const shown of ['New task', 'What needs to happen?', 'Status', 'Priority', 'Assignee', 'Labels', 'Suggest from description', 'Create task']) {
      expect(html).toContain(shown);
    }
    for (const gone of ['Create another', 'Switch to', 'Create with agent', 'Deconstruct user prompt']) {
      expect(html).not.toContain(gone);
    }
  });

  it('offers to plan a build only to roles that can run one', () => {
    canRunBuilds = true;
    expect(render()).toContain('Plan a build when it’s created');
    canRunBuilds = false;
    expect(render()).not.toContain('Plan a build when it’s created');
    canRunBuilds = true;
  });
});
