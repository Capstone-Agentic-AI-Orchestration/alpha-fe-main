import { describe, expect, it } from 'vitest';
import { isSidebarShortcut, readSidebarOpen, writeSidebarOpen } from './useSidebarToggle';

const key = (overrides: Partial<Parameters<typeof isSidebarShortcut>[0]> = {}) => ({
  key: 'b', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...overrides,
});

describe('sidebar toggle', () => {
  it('opens and closes with Ctrl+B or Cmd+B only', () => {
    expect(isSidebarShortcut(key())).toBe(true);
    expect(isSidebarShortcut(key({ ctrlKey: false, metaKey: true }))).toBe(true);
    expect(isSidebarShortcut(key({ key: 'B' }))).toBe(true);
    expect(isSidebarShortcut(key({ ctrlKey: false }))).toBe(false);
    expect(isSidebarShortcut(key({ shiftKey: true }))).toBe(false);
    expect(isSidebarShortcut(key({ key: 'k' }))).toBe(false);
    expect(isSidebarShortcut(key({ defaultPrevented: true }))).toBe(false);
  });

  it('starts closed and remembers the last choice on this device', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (name: string) => values.get(name) ?? null, setItem: (name: string, value: string) => { values.set(name, value); } };
    expect(readSidebarOpen('alpha.sidebar', storage)).toBe(false);
    writeSidebarOpen('alpha.sidebar', true, storage);
    expect(readSidebarOpen('alpha.sidebar', storage)).toBe(true);
    writeSidebarOpen('alpha.sidebar', false, storage);
    expect(readSidebarOpen('alpha.sidebar', storage)).toBe(false);
  });
});
