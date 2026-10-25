import type { DesktopBridge } from '@/shared/desktop';
import { DEFAULT_THEME_ID, normalizeThemeId } from './registry';
import type { ThemeId, ThemePreferenceStore } from './types';

export const APPEARANCE_STORAGE_KEY = 'alpha.appearance.v1';
export function parsePreference(value: string | null): ThemeId {
  try { const parsed = JSON.parse(value ?? 'null'); return parsed?.version === 1 ? normalizeThemeId(parsed.themeId) : DEFAULT_THEME_ID; }
  catch { return DEFAULT_THEME_ID; }
}
/** Storage adapters perform IO only; never change styles or chat/workspace data. */
export function browserPreferenceStore(target: Window): ThemePreferenceStore {
  return {
    read: () => { try { return parsePreference(target.localStorage.getItem(APPEARANCE_STORAGE_KEY)); } catch { return DEFAULT_THEME_ID; } },
    write: async id => { target.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({version:1,themeId:id})); },
    subscribe: listener => {
      const onStorage = (event: StorageEvent) => {
        if(event.storageArea && event.storageArea !== target.localStorage) return;
        if(event.key === APPEARANCE_STORAGE_KEY || event.key === null) listener(parsePreference(event.newValue));
      };
      target.addEventListener('storage', onStorage);
      return () => target.removeEventListener('storage', onStorage);
    },
  };
}
export function createPreferenceStore(target: Window, bridge?: DesktopBridge): ThemePreferenceStore {
  if (!bridge?.setAppearanceTheme) return browserPreferenceStore(target);
  return {
    read: () => normalizeThemeId(bridge.appearanceThemeId),
    write: async id => {
      const result = await bridge.setAppearanceTheme!(id);
      if (result.themeId !== id) throw new Error('Desktop did not confirm the selected theme');
    },
    subscribe: listener => bridge.onAppearanceThemeChanged?.(id => listener(normalizeThemeId(id))) ?? (()=>undefined),
  };
}
