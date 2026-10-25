import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalPreviewTab, WebPreviewCard } from './LocalPreview';
import type { LocalPreview } from '@/shared/types/localPreview';
const record = { id: 'preview', repository: 'acme/site', branch: 'dev', commit: 'a'.repeat(40), source: 'saved-build', state: 'stopped', logs: '' } as LocalPreview;
describe('local preview display', () => {
  it('shows captured browser failures separately from server readiness', () => {
    const panel = renderToStaticMarkup(<LocalPreviewTab record={{ ...record, state: 'ready', browserDiagnostics: [{ kind: 'blocked', message: 'Preview isolation blocked resource: https://images.example/photo.jpg', timestamp: '2026-10-25T00:00:00Z' }] }} repositories={[]} busy={false} error="" onStart={() => {}} onStop={() => {}} />);
    expect(panel).toContain('Browser diagnostics'); expect(panel).toContain('images.example/photo.jpg');
    expect(panel).toContain('reflect preview isolation'); expect(panel).toContain('Local · ready');
  });
  it('shows the requested compact card and availability instead of inventing an embed', () => {
    const card = renderToStaticMarkup(<WebPreviewCard record={record} onOpen={() => {}} />);
    expect(card).toContain('Web preview'); expect(card).toContain('Open in'); expect(card).toContain('Right panel');
    const panel = renderToStaticMarkup(<LocalPreviewTab record={record} repositories={['acme/site']} busy={false} error="" onStart={() => {}} onStop={() => {}} />);
    expect(panel).toContain('Saved build checkpoint'); expect(panel).toContain('aaaaaaaa'); expect(panel).toContain('available in Alpha desktop');
    expect(panel).not.toContain('<iframe'); expect(panel).not.toContain('Session ·');
  });
});
