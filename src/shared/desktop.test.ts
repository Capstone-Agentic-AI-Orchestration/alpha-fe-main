import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('desktop bridge detection', () => {
  it('can be imported without a browser window', async () => {
    vi.stubGlobal('window', undefined);
    const { desktop, isDesktop } = await import('./desktop');
    expect(desktop).toBeUndefined();
    expect(isDesktop).toBe(false);
  });

  it('does not identify a normal browser as the desktop app', async () => {
    vi.stubGlobal('window', {});
    const { desktop, isDesktop } = await import('./desktop');
    expect(desktop).toBeUndefined();
    expect(isDesktop).toBe(false);
  });

  it('preserves the preload bridge and its runtime addresses', async () => {
    const bridge = {
      isDesktop: true,
      platform: 'win32',
      apiBase: 'http://127.0.0.1:41001/api',
      wsUrl: 'ws://127.0.0.1:41001',
      versions: { electron: 'test', node: 'test', chrome: 'test' },
    };
    vi.stubGlobal('window', { alphaDesktop: bridge });
    const { desktop, isDesktop } = await import('./desktop');
    expect(desktop).toBe(bridge);
    expect(isDesktop).toBe(true);
  });

  it('supports an older preload without optional capabilities', async () => {
    const bridge = {
      isDesktop: true,
      platform: 'win32',
      versions: { electron: 'test', node: 'test', chrome: 'test' },
    };
    vi.stubGlobal('window', { alphaDesktop: bridge });
    const { desktop, isDesktop } = await import('./desktop');
    expect(desktop).toBe(bridge);
    expect(desktop?.apiBase).toBeUndefined();
    expect(isDesktop).toBe(true);
  });
});
