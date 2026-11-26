import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Project modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

let canRunBuilds = true;
let visibleTabs = ['clients'];
let sessionValues: Record<string, unknown> = {};
let projects = [{ id: 'p1', name: 'Website refresh', key: 'WEB' }];
vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    createIssue: vi.fn(),
    showToast: vi.fn(),
    projects,
    identity: { login: 'maya-reyes', name: 'Maya Reyes' },
    visibleTabs,
    can: (capability: string) => capability !== 'run_builds' || canRunBuilds
  }),
  useTabSessionState: <T,>(key: string, initial: T) => [key in sessionValues ? sessionValues[key] : initial, () => undefined]
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
    for (const shown of ['New task', 'Task title', 'What needs to happen?', 'Description', 'Due date', 'Status', 'Priority', 'Assignee', 'Labels', 'Checklist items', 'Suggest steps with Alpha', 'Create task']) {
      expect(html).toContain(shown);
    }
    for (const gone of ['More options', '<details', 'Create another', 'Switch to', 'Create with agent', 'Deconstruct user prompt', 'Suggest from description', 'Plan a build when it’s created']) {
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

  it('shows the client request a task is for, only to those who see clients', () => {
    sessionValues = { 'issueModal.linkedRequest': { ticketId: 't-1', title: 'Add a contact form', source: 'conversation' } };
    const html = render();
    expect(html).toContain('Client request');
    expect(html).toContain('Add a contact form');
    visibleTabs = [];
    expect(render()).not.toContain('Client request');
    visibleTabs = ['clients'];
    sessionValues = {};
    expect(render()).not.toContain('Client request');
  });

  it('opened from a request, shows its project and request instead of asking for them', () => {
    projects = [{ id: 'p1', name: 'Website refresh', key: 'WEB' }, { id: 'p2', name: 'Resort site', key: 'RES' }];
    expect(render()).toContain('Project</span>');
    sessionValues = {
      'issueModal.project': 'p1',
      'issueModal.projectLocked': true,
      'issueModal.linkedRequest': { ticketId: 't-1', reference: 'TKT-28EC59', title: 'Add a contact form', source: 'conversation' }
    };
    const html = render();
    expect(html).toContain('In Website refresh');
    expect(html).toContain('TKT-28EC59');
    expect(html).toContain('Add a contact form');
    expect(html).not.toContain('Project</span>');
    expect(html).not.toContain('Not for a client request');
    sessionValues = {};
    projects = [{ id: 'p1', name: 'Website refresh', key: 'WEB' }];
  });

  it('explains why creation is disabled until the required title is present', () => {
    const html = render();
    expect(html).toContain('Enter a task name first.');
    expect(html).toContain('disabled:cursor-default');
  });
});
