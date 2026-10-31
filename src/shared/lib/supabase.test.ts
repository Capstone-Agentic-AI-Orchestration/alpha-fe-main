import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  workspaceId: 'ws-a' as string | null,
  getToken: vi.fn(),
  readToken: undefined as undefined | (() => Promise<string>)
}));

vi.mock('@/shared/services/apiService', () => ({
  apiService: { getDatabaseToken: auth.getToken },
  getActiveWorkspaceId: () => auth.workspaceId
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: { accessToken: () => Promise<string> }) => {
    auth.readToken = options.accessToken;
    return {};
  }
}));

const response = (token: string) => ({ token, expiresAt: new Date(Date.now() + 600_000).toISOString() });

beforeEach(async () => {
  vi.resetModules();
  auth.getToken.mockReset();
  auth.workspaceId = 'ws-a';
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon');
  await import('./supabase');
});
afterEach(() => vi.unstubAllEnvs());

describe('workspace-scoped realtime tokens', () => {
  it('deduplicates requests and caches only within the selected workspace', async () => {
    auth.getToken.mockResolvedValue(response('token-a'));
    expect(await Promise.all([auth.readToken!(), auth.readToken!()])).toEqual(['token-a', 'token-a']);
    expect(await auth.readToken!()).toBe('token-a');
    expect(auth.getToken).toHaveBeenCalledOnce();

    auth.workspaceId = 'ws-b';
    auth.getToken.mockResolvedValue(response('token-b'));
    expect(await auth.readToken!()).toBe('token-b');
    expect(auth.getToken).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a stale in-flight response after switching workspaces', async () => {
    let finishA!: (value: ReturnType<typeof response>) => void;
    auth.getToken.mockImplementationOnce(() => new Promise(resolve => { finishA = resolve; }))
      .mockResolvedValue(response('token-b'));
    const stale = auth.readToken!();
    auth.workspaceId = 'ws-b';
    expect(await auth.readToken!()).toBe('token-b');
    finishA(response('token-a'));
    expect(await stale).toBe('public-anon');
    expect(await auth.readToken!()).toBe('token-b');
    expect(auth.getToken).toHaveBeenCalledTimes(2);
  });

  it('fails closed on token errors and retries instead of caching the anon fallback', async () => {
    auth.getToken.mockRejectedValueOnce(new Error('not authorized')).mockResolvedValue(response('token-a'));
    expect(await auth.readToken!()).toBe('public-anon');
    expect(await auth.readToken!()).toBe('token-a');
    expect(auth.getToken).toHaveBeenCalledTimes(2);
  });
});
