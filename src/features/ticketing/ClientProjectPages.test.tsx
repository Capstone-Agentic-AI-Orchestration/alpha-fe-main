import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientOverviewPage } from './ClientProjectPages';
import { sharedBuildState } from './PmProjectQaStudio';
import { QaPreview, previewViewport } from './ProjectQaStudio';
import type { QaBuild } from './projectQaApi';

describe('client overview loading', () => {
  it('shows loaded projects while requests are pending, then distinguishes a confirmed empty queue', () => {
    const callbacks = { onOpenRequest: () => {}, onOpenProject: () => {}, onGoToProjects: () => {}, onGoToRequests: () => {} };
    const loaded = { items: [], nextCursor: null, counters: { kind: 'client' as const, open: 0, needsClient: 0 } };
    const loading = renderToStaticMarkup(<ClientOverviewPage requests={null} requestsLoading requestsError=""
      projects={[]} projectsLoading={false} projectsError="" {...callbacks} />);
    expect(loading).toContain('Loading recent request updates');
    expect(loading).toContain('No projects have been shared');
    expect(loading).not.toContain('all caught up');
    const ready = renderToStaticMarkup(<ClientOverviewPage requests={loaded} requestsLoading requestsError=""
      projects={[]} projectsLoading projectsError="" {...callbacks} />);
    expect(ready).toContain('all caught up');
    expect(ready).toContain('Loading shared projects');
    expect(ready).not.toContain('Loading recent request updates');
  });

  it('leads with the banner and what needs the client, then each project as a fixed-size card with its counts, not its request list', () => {
    const callbacks = { onOpenRequest: () => {}, onOpenProject: () => {}, onGoToProjects: () => {}, onGoToRequests: () => {} };
    const base = { reference: 'REF-1', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', closedAt: null,
      readOnly: false, writesAvailable: true, workspaceId: 'w1', projectId: 'p1', projectName: 'Shop', projectLinkStatus: 'linked' as const,
      requestedProjectName: null };
    const items = [
      { ...base, id: 'a', title: 'Pick the checkout colours', status: 'awaiting_client' as const, requestedAction: 'agree_scope' as const },
      { ...base, id: 'b', title: 'Add a gift message field', status: 'in_progress' as const, requestedAction: null },
    ];
    const html = renderToStaticMarkup(<ClientOverviewPage clientName="Alex Morgan" requestsLoading={false} requestsError=""
      requests={{ items, nextCursor: null, counters: { kind: 'client', open: 2, needsClient: 1 } }}
      projects={[{ workspaceId: 'w1', projectId: 'p1', name: 'Shop', updatedAt: '2026-11-01T00:00:00Z', intakeOptionId: 'o1', preview: null }]}
      projectsLoading={false} projectsError="" onProposeProject={() => {}} {...callbacks} />);
    expect(html).toContain('1 thing needs you');
    expect(html).toContain('Review plan');
    expect(html).not.toContain('all caught up');
    // The waiting request shows its step on its action card; the project cover only counts requests.
    expect(html).toContain('Step 2 of 5');
    expect(html).not.toContain('Step 3 of 5');
    expect(html).not.toContain('more in this project');
    const card = html.slice(html.indexOf('class="cx-pcard"'), html.indexOf('client-recent-title'));
    expect(card).toContain('aria-label="Requests in Shop"');
    expect(card).toContain('<dt>Open</dt><dd>2</dd>');
    expect(card).toContain('1 needs you');
    expect(card).not.toContain('Add a gift message field');
    // Proposing is the banner's one main action; Home has no second propose card further down.
    expect(html.match(/Propose a project/g)).toHaveLength(1);
    expect(html.indexOf('Propose a project')).toBeLessThan(html.indexOf('client-attention-title'));
    expect(html).not.toContain('REF-1');
  });

  it('always offers Open preview on a project card, with the preview picture once shared and artwork before', () => {
    const callbacks = { onOpenRequest: () => {}, onOpenProject: () => {}, onOpenPreview: () => {}, onGoToProjects: () => {}, onGoToRequests: () => {} };
    const loaded = { items: [], nextCursor: null, counters: { kind: 'client' as const, open: 0, needsClient: 0 } };
    const shop = { workspaceId: 'w1', projectId: 'p1', name: 'Shop', updatedAt: '2026-11-01T00:00:00Z', intakeOptionId: 'o1', preview: null };
    const render = (preview: typeof shop.preview | { branch: 'uat'; url: string }) => renderToStaticMarkup(<ClientOverviewPage requests={loaded}
      requestsLoading={false} requestsError="" projects={[{ ...shop, preview }]} projectsLoading={false} projectsError="" {...callbacks} />);
    const waiting = render(null);
    expect(waiting).toContain('no preview yet');
    // The preview page opens before anything is shared and says so there; only the picture waits.
    expect(waiting).toContain('aria-label="Open preview for Shop"');
    expect(waiting).toContain('aria-label="Open project: Shop"');
    expect(waiting).toContain('cx-cover-art');
    expect(waiting).not.toContain('cx-thumb');
    const ready = render({ branch: 'uat', url: 'https://shop-uat.vercel.app' });
    expect(ready).toContain('preview ready');
    expect(ready).toContain('cx-thumb');
    expect(ready).not.toContain('cx-cover-art');
    const links = ready.slice(ready.indexOf('class="cx-card-links"'));
    expect(links.indexOf('aria-label="Open preview for Shop"')).toBeGreaterThan(-1);
    expect(links.indexOf('aria-label="Open project: Shop"')).toBeGreaterThan(links.indexOf('aria-label="Open preview for Shop"'));
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
    expect(pm).toContain('Your project manager reviews the UAT build before sharing it here.');
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
  it('tells the PM whether clients see the current UAT build', () => {
    const build = { frontend: { repository: 'org/shop', branch: 'uat', deploymentId: 'd', commitSha: 'c', url: 'https://shop-new.vercel.app' } } as QaBuild;
    const shared = { repository: 'org/shop', branch: 'uat' as const, url: 'https://shop-old.vercel.app' };
    expect(sharedBuildState(null, null)).toBe('none');
    expect(sharedBuildState(build, null)).toBe('unshared');
    expect(sharedBuildState(build, shared)).toBe('newer');
    expect(sharedBuildState(build, { ...shared, url: build.frontend.url })).toBe('current');
  });
});
