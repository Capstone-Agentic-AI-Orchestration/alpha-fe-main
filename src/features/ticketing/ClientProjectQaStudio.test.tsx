import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientOverviewPage } from './ClientProjectPages';
import { QaPreview, previewViewport } from './ProjectQaStudio';

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
