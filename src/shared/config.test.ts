import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

const bridge = (localToken?: string) => ({
  alphaDesktop: {
    isDesktop: true,
    platform: 'win32',
    apiBase: 'http://127.0.0.1:41001/api',
    wsUrl: 'ws://127.0.0.1:41001',
    ...(localToken ? { localToken } : {}),
    versions: { electron: 'test', node: 'test', chrome: 'test' },
  },
});

describe('local engine token', () => {
  it('uses the token the desktop hands over at runtime', async () => {
    vi.stubEnv('VITE_ALPHA_LOCAL_TOKEN', 'source-run');
    vi.stubGlobal('window', bridge('f'.repeat(64)));
    const { LOCAL_TOKEN, localStreamProtocols } = await import('./config');
    expect(LOCAL_TOKEN).toBe('f'.repeat(64));
    expect(localStreamProtocols()).toEqual(['alpha.v1', `alpha.token.${"f".repeat(64)}`]);
  });

  it('falls back to a source-run token, and to none in the web build', async () => {
    vi.stubEnv('VITE_ALPHA_LOCAL_TOKEN', 'source-run');
    vi.stubGlobal('window', {});
    expect((await import('./config')).LOCAL_TOKEN).toBe('source-run');

    vi.resetModules();
    vi.stubEnv('VITE_ALPHA_LOCAL_TOKEN', '');
    const web = await import('./config');
    expect(web.LOCAL_TOKEN).toBeUndefined();
    expect(web.localStreamProtocols()).toBeUndefined();
  });

  it('sends the token on API calls', async () => {
    vi.stubEnv('VITE_API_URL', '/api');
    vi.stubGlobal('window', bridge('e'.repeat(64)));
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiService } = await import('./services/apiService');
    await apiService.getProjects().catch(() => undefined);
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get('X-Alpha-Token')).toBe('e'.repeat(64));
  });
});
