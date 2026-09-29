import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRepoTab, readStoredTab, REPO_TABS, storeTab, tabForKey } from './repoTabs';

describe('moving between repository tabs by keyboard', () => {
  it('steps with the arrows and wraps at both ends', () => {
    expect(tabForKey('overview', 'ArrowRight')).toBe('code');
    expect(tabForKey('environment', 'ArrowRight')).toBe('overview');
    expect(tabForKey('overview', 'ArrowLeft')).toBe('environment');
  });

  it('jumps to the ends with Home and End, and leaves every other key alone', () => {
    expect(tabForKey('logs', 'Home')).toBe('overview');
    expect(tabForKey('code', 'End')).toBe('environment');
    expect(tabForKey('code', 'Enter')).toBeNull();
    expect(tabForKey('code', 'Tab')).toBeNull();
  });
});

describe('the remembered tab', () => {
  const storage = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value)
    }
  };

  afterEach(() => {
    storage.clear();
    vi.unstubAllGlobals();
  });

  it('comes back as it was stored', () => {
    vi.stubGlobal('window', fakeWindow);
    storeTab('logs');
    expect(readStoredTab()).toBe('logs');
  });

  /** A tab renamed or removed in a later version must not leave the page on nothing. */
  it('falls back to Overview for anything that is not a tab, or when storage is blocked', () => {
    vi.stubGlobal('window', fakeWindow);
    storage.set('alpha.repository.tab', 'hosting');
    expect(readStoredTab()).toBe('overview');

    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(readStoredTab()).toBe('overview');
    expect(() => storeTab('code')).not.toThrow();
  });

  it('knows every tab it lists', () => {
    expect(REPO_TABS.every(tab => isRepoTab(tab.id))).toBe(true);
    expect(isRepoTab('settings')).toBe(false);
  });
});
