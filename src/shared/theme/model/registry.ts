import manifest from './manifest.json';
import modes from './modes.json';
import { resolveTheme } from './themeResolver.mjs';
import type { ResolvedTheme, ThemeId } from './types';

const definitions = import.meta.glob('./palettes/*.json', {eager:true,import:'default'});
export const DEFAULT_THEME_ID = manifest.defaultId as ThemeId;
export const THEMES: readonly ResolvedTheme[] = Object.entries(manifest.themes).map(([id,file]) => {
  const resolved=resolveTheme(definitions[`./${file}`],modes);
  if(resolved.id!==id) throw new Error('Theme identity does not match manifest');
  return resolved;
});
export function isThemeId(value: unknown): value is ThemeId { return typeof value === 'string' && Object.prototype.hasOwnProperty.call(manifest.themes, value); }
export function normalizeThemeId(value: unknown): ThemeId { return isThemeId(value) ? value : DEFAULT_THEME_ID; }
export function getTheme(value: unknown): ResolvedTheme { return THEMES.find(theme=>theme.id===normalizeThemeId(value))!; }
export { rgbChannels } from './themeResolver.mjs';
