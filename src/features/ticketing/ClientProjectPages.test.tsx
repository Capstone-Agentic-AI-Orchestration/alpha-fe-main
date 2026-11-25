import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientOverviewPage } from './ClientProjectPages';
import { sharedBuildState } from './PmProjectQaStudio';
import { QaPreview, previewViewport } from './ProjectQaStudio';
import type { QaBuild } from './projectQaApi';

describe('client overview loading', () => {
  const callbacks = { onOpenRequest: () => {}, onOpenProject: () => {}, onGoToProjects: () => {}, onGoToRequests: () => {} };
  const empty = { items: [], nextCursor: null, counters: { kind: 'client' as const, open: 0, needsClient: 0 } };

  it('shows the project state while requests are pending, and hides Waiting on you once nothing needs the client', () => {
    const loading = renderToStaticMarkup(<ClientOverviewPage requests={null} requestsLoading requestsError=""
      projects={[]} projectsLoading={false} projectsError="" {...callbacks} />);
    expect(loading).toContain('Loading requests needing attention');
    expect(loading).toContain('No projects yet');
    expect(loading).toContain('When the project manager shares a project, it will appear here.');
    const ready = renderToStaticMarkup(<ClientOverviewPage requests={empty} requestsLoading requestsError=""
      projects={[]} projectsLoading projectsError="" {...callbacks} />);
    // A confirmed empty queue drops the section rather than showing an empty panel.
    expect(ready).not.toContain('client-attention-title');
    expect(ready).not.toContain('Loading requests needing attention');
    expect(ready).toContain('Loading your projects');
    expect(ready).not.toContain('No projects yet');
  });

  it('leads with the banner and what needs the client, then features a project and its own updates', () => {
    const base = { reference: 'REF-1', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', closedAt: null,
      readOnly: false, writesAvailable: true, workspaceId: 'w1', projectId: 'p1', projectName: 'Shop', projectLinkStatus: 'linked' as const,
      requestedProjectName: null };
    const items = [
      { ...base, id: 'a', title: 'Pick the checkout colours', status: 'awaiting_client' as const, requestedAction: 'agree_scope' as const },
      { ...base, id: 'b', title: 'Add a gift message field', status: 'in_progress' as const, requestedAction: null },
      { ...base, id: 'c', title: 'Other project request', projectId: 'p2', projectName: 'Blog', status: 'in_progress' as const, requestedAction: null },
    ];
    const render = (extra: { onProposeProject?: () => void; newRequestAction?: JSX.Element }) => renderToStaticMarkup(<ClientOverviewPage
      clientName="Alex Morgan" requestsLoading={false} requestsError=""
      requests={{ items, nextCursor: null, counters: { kind: 'client', open: 3, needsClient: 1 } }}
      projects={[{ workspaceId: 'w1', projectId: 'p1', name: 'Shop', updatedAt: '2026-11-02T00:00:00Z', intakeOptionId: 'o1', preview: null },
        { workspaceId: 'w1', projectId: 'p2', name: 'Blog', updatedAt: '2026-11-01T00:00:00Z', intakeOptionId: 'o2', preview: null }]}
      projectsLoading={false} projectsError="" {...extra} {...callbacks} />);
    const html = render({ onProposeProject: () => {} });
    expect(html).toContain('Alex');
    expect(html).toContain('Waiting on you');
    expect(html).toContain('Review plan');
    expect(html).toContain('Step 2 of 5');
    // Waiting work comes before the projects.
    expect(html.indexOf('client-attention-title')).toBeLessThan(html.indexOf('aria-label="Project showcase"'));
    const stage = html.slice(html.indexOf('class="cx-showcase-stage"'), html.indexOf('class="cx-showcase-updates'));
    expect(stage).toContain('class="cx-showcase-overlay"');
    expect(stage).toContain('Featured project · 1 of 2');
    expect(stage).toContain('class="cx-showcase-project-link" title="Shop"><span>Shop</span>');
    expect(stage).toContain('Show next project');
    expect(html).not.toContain('Requests in Shop');
    expect(html).not.toContain('Choose a featured project');
    // Its updates list its own requests, not another project's.
    const updates = html.slice(html.indexOf('cx-showcase-updates-title'));
    expect(updates).toContain('Add a gift message field');
    expect(updates).not.toContain('Other project request');
    // Proposing is the banner's one main action, ahead of everything else.
    expect(html.match(/Propose a project/g)).toHaveLength(1);
    expect(html.indexOf('Propose a project')).toBeLessThan(html.indexOf('client-attention-title'));
    expect(html).not.toContain('REF-1');
    // The new-request menu replaces the propose button when the portal passes one.
    const withMenu = render({ onProposeProject: () => {}, newRequestAction: <button type="button">New request</button> });
    expect(withMenu).toContain('New request');
    expect(withMenu).not.toContain('Propose a project');
  });

  it('offers the preview shortcut and picture once the featured project has a shared preview', () => {
    const shop = { workspaceId: 'w1', projectId: 'p1', name: 'Shop', updatedAt: '2026-11-01T00:00:00Z', intakeOptionId: 'o1', preview: null };
    const render = (preview: typeof shop.preview | { branch: 'uat'; url: string }) => renderToStaticMarkup(<ClientOverviewPage requests={empty}
      requestsLoading={false} requestsError="" projects={[{ ...shop, preview }]} projectsLoading={false} projectsError=""
      onOpenPreview={() => {}} {...callbacks} />);
    const waiting = render(null);
    expect(waiting).toContain('There is still no preview.');
    expect(waiting).toContain('class="cx-showcase-overlay"');
    expect(waiting).not.toContain('Open preview');
    expect(waiting).not.toContain('cx-thumb');
    const ready = render({ branch: 'uat', url: 'https://shop-uat.vercel.app' });
    expect(ready).toContain('cx-thumb');
    expect(ready).not.toContain('cx-thumb-bar');
    expect(ready).toContain('class="cx-showcase-host">shop-uat.vercel.app</p>');
    expect(ready).not.toContain('There is still no preview.');
    expect(ready).toContain('aria-label="Open preview"');
  });
});

describe('client project review presentation', () => {
  it('uses plain client preview wording while keeping the PM default', () => {
    const client = renderToStaticMarkup(<QaPreview preview={null} audience="client" />);
    expect(client).toContain('Reload project preview');
    expect(client).not.toContain('pqa-env');
    expect(client).toContain('No preview shared yet');
    expect(client).toContain('Your preview will appear here when it is shared.');
    expect(client).not.toContain('UAT');
    const pm = renderToStaticMarkup(<QaPreview preview={null} />);
    expect(pm).toContain('UAT preview');
    expect(pm).toContain('Reload UAT preview');
    expect(pm).toContain('The project manager reviews the UAT build before sharing it here.');
  });

  it('previews devices at their real CSS width and only shrinks when the stage is narrower', () => {
    expect(previewViewport('phone', { width: 1200, height: 700 })).toMatchObject({ width: 390, scale: 1 });
    expect(previewViewport('tablet', { width: 1200, height: 2000 })).toMatchObject({ width: 768, height: 1024, scale: 1 });
    const narrowTablet = previewViewport('tablet', { width: 600, height: 700 });
    expect(narrowTablet.width).toBe(768);
    expect(narrowTablet.scale).toBeLessThan(1);
    // Narrow stages still render the desktop breakpoint, scaled to fit.
    expect(previewViewport('desktop', { width: 1000, height: 600 })).toMatchObject({ width: 1280, scale: 1000 / 1280 });
    expect(previewViewport('desktop', { width: 1600, height: 600 })).toMatchObject({ width: 1600, height: 600, scale: 1 });
  });
});

describe('project review shared build', () => {
  it('keeps a single review refresh in the preview toolbar, even before a build exists', () => {
    const render = (refreshDisabled: boolean) => renderToStaticMarkup(<QaPreview preview={null}
      onRefresh={() => undefined} refreshDisabled={refreshDisabled} />);
    expect(render(false)).toMatch(/class="pqa-toolbar".*<button[^>]*class="pqa-refresh-review" aria-label="Refresh project review"/);
    expect(render(false)).not.toContain('Reload UAT preview');
    expect(render(true)).toContain('class="pqa-refresh-review" disabled="" aria-label="Refresh project review"');
  });

  it('tells the PM whether clients see the current UAT build', () => {
    const build = { frontend: { repository: 'org/shop', branch: 'uat', deploymentId: 'd', commitSha: 'c', url: 'https://shop-new.vercel.app' } } as QaBuild;
    const shared = { repository: 'org/shop', branch: 'uat' as const, url: 'https://shop-old.vercel.app' };
    expect(sharedBuildState(null, null)).toBe('none');
    expect(sharedBuildState(build, null)).toBe('unshared');
    expect(sharedBuildState(build, shared)).toBe('newer');
    expect(sharedBuildState(build, { ...shared, url: build.frontend.url })).toBe('current');
  });
});
