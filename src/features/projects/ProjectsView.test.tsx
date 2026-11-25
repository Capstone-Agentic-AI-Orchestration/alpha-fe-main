import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

const project = {
  id: 'project-1', name: 'Sample website', key: 'WEB', status: 'planned', priority: 'medium',
  description: 'Use the shared design system.', resources: []
};
let storedSection: string;
let canEdit: boolean;

vi.mock('@/app/AppContext', () => ({
  useApp: () => ({
    projects: [project], issues: [], role: 'pm', activeWorkspaceId: 'workspace-1',
    can: (permission: string) => permission === 'edit_projects' && canEdit,
  }),
  useTabSessionState: (key: string, initialValue: unknown) => {
    if (key === 'projects.selectedProject') return [project.id];
    if (key === `projects.workspaceTab:${project.id}`) return [storedSection];
    return [initialValue];
  },
}));
vi.mock('@/features/issues/IssuesView', () => ({ IssuesView: () => null }));
vi.mock('./repository/useProjectRepos', () => ({
  useProjectRepos: () => ({ repos: ['example/website'], loading: false }),
}));

import { ProjectsView } from './ProjectsView';

function render(section: string, editable: boolean) {
  storedSection = section;
  canEdit = editable;
  return renderToStaticMarkup(<ProjectsView />);
}

describe('project workspace navigation', () => {
  it('restores old Details sessions as Settings, with one edit action inside the panel', () => {
    const html = render('details', true);
    const settings = html.indexOf('-panel-settings" role="tabpanel"');
    expect(settings).toBeGreaterThan(-1);
    expect(html).toMatch(/-tab-settings"[^>]*aria-selected="true"/);
    expect(html).not.toMatch(/-tab-(details|previews)"/);
    expect(html).not.toContain('aria-label="Project progress"');
    expect(html.slice(0, settings)).not.toContain('Edit project');
    expect(html.slice(settings)).toContain('Edit project');
    expect(html).toContain('Use the shared design system.');
    expect(html).toContain('Repositories');
    expect(render('settings', false)).not.toContain('Edit project');
  });

  it('opens Hosting and Variables under Environment for old Previews sessions', () => {
    const html = render('previews', true);
    expect(html).toMatch(/-tab-environment"[^>]*aria-selected="true"/);
    expect(html).toContain('repo-hosting-example/website');
    expect(html).toContain('repo-env-example/website');
    expect(html).not.toContain('repo-previews-');
  });
});
