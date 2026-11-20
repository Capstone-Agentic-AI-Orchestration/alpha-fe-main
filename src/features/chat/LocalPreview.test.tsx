import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalPreviewTab, WebPreviewCard, previewAnchorId } from './LocalPreview';
import type { LocalPreview } from '@/shared/types/localPreview';
const record = { id: 'preview', repository: 'acme/site', branch: 'dev', commit: 'a'.repeat(40), source: 'saved-build', state: 'stopped', logs: '' } as LocalPreview;
describe('local preview display', () => {
  it('shows captured browser failures separately from server readiness', () => {
    const panel = renderToStaticMarkup(<LocalPreviewTab record={{ ...record, state: 'ready', browserDiagnostics: [{ kind: 'blocked', message: 'Preview isolation blocked resource: https://images.example/photo.jpg', timestamp: '2026-10-25T00:00:00Z' }] }} error="" onStop={() => {}} />);
    expect(panel).toContain('Browser diagnostics'); expect(panel).toContain('images.example/photo.jpg');
    expect(panel).toContain('reflect preview isolation'); expect(panel).toContain('Local · ready');
  });
  it('shows the requested compact card and availability instead of inventing an embed', () => {
    const card = renderToStaticMarkup(<WebPreviewCard record={record} onOpen={() => {}} />);
    expect(card).toContain('Web preview'); expect(card).toContain('Open in'); expect(card).toContain('Right panel');
    const panel = renderToStaticMarkup(<LocalPreviewTab record={record} error="" onStop={() => {}} />);
    expect(panel).toContain('Saved build checkpoint'); expect(panel).toContain('aaaaaaaa'); expect(panel).toContain('available in Alpha desktop');
    expect(panel).not.toContain('Start preview'); expect(panel).not.toContain('Preview codebase'); expect(panel).not.toContain('>Restart<');
    expect(panel).toContain('Ask the Orchestrator in the main chat');
    expect(panel).not.toContain('<iframe'); expect(panel).not.toContain('Session ·');
  });
});

/** The preview card used to sit below the newest message for ever; it now stays with its reply. */
describe('where the preview card sits in the conversation', () => {
  const messages = [
    { id: 'ask', senderType: 'user', timestamp: '2026-11-20T10:00:00Z' },
    { id: 'reply', senderType: 'agent', timestamp: '2026-11-20T10:00:05Z' },
    { id: 'later-ask', senderType: 'user', timestamp: '2026-11-20T10:05:00Z' },
    { id: 'later-reply', senderType: 'agent', timestamp: '2026-11-20T10:05:05Z' }
  ];
  it('goes under the reply to the request that started it, not under later messages', () => {
    expect(previewAnchorId(messages, { messageId: 'ask', createdAt: '2026-11-20T10:00:02Z' })).toBe('reply');
    expect(previewAnchorId(messages, { messageId: 'reply', createdAt: '2026-11-20T10:00:02Z' })).toBe('reply');
  });
  it('falls back to the last reply before the preview started, or nothing', () => {
    expect(previewAnchorId(messages, { createdAt: '2026-11-20T10:01:00Z' })).toBe('reply');
    expect(previewAnchorId(messages, { messageId: 'gone', createdAt: '2026-11-20T09:00:00Z' })).toBeNull();
  });
});
