import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('@/shared/config'); vi.resetModules(); });

describe.each(['/api', 'http://127.0.0.1:60233/api'])('preview transport with base %s', base => {
  it('prefixes list/start/stop exactly once and preserves caller scope', async () => {
    vi.resetModules(); vi.doMock('@/shared/config', () => ({ API_BASE: base, LOCAL_TOKEN: undefined }));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    vi.stubGlobal('fetch', fetchMock);
    const transport = await import('./apiService');
    transport.setActiveWorkspaceId('workspace-preview');
    await transport.getLocalPreviews('thread/a');
    await transport.startLocalPreview('thread/a', 'acme/site');
    await transport.stopLocalPreview('thread/a', 'preview/b');
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      `${base}/chat/threads/thread%2Fa/previews`,
      `${base}/chat/threads/thread%2Fa/previews`,
      `${base}/chat/threads/thread%2Fa/previews/preview%2Fb/stop`,
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.credentials).toBe('include');
      expect(new Headers(options.headers).get('X-Workspace-Id')).toBe('workspace-preview');
    }
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ repository: 'acme/site' }) });
    expect(fetchMock.mock.calls[2][1].method).toBe('POST');
  });
});
