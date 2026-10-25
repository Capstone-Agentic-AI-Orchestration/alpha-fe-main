import type manifest from './manifest.json';

export type ThemeId = keyof typeof manifest.themes;
export type ThemeMode = 'dark' | 'light';
export type ThemeColorRole = 'canvas' | 'shell' | 'surface' | 'raised' | 'high' | 'well' | 'textPrimary' | 'textSecondary' | 'textMuted' | 'accent' | 'action' | 'actionHover' | 'link' | 'linkHover' | 'focus' | 'divider' | 'control' | 'sceneIdle';
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode;
  colors: Record<ThemeColorRole, string>;
}
export interface ScenePalette {
  background: string; hub: string; hubEmissive: string; idle: string; orbit: string; ring: string;
  wave: string; waveActive: string; highlight: string; glow: string; labelBackground: string; labelForeground: string;
  success: string; warning: string; danger: string; info: string;
}
export interface ResolvedTheme extends Omit<ThemeDefinition, 'colors'> {
  colors: Record<ThemeColorRole | 'success' | 'warning' | 'danger' | 'info' | 'overlay' | 'onAction' | 'selected' | 'selectedContent' | 'code' | 'codeContent' | 'diffAdded' | 'diffAddedContent' | 'diffRemoved' | 'diffRemovedContent' | 'diffHunk', string>;
  scene: ScenePalette;
}
export interface ThemePreference { version: 1; themeId: ThemeId }
export interface ThemePreferenceStore {
  read(): ThemeId;
  write(id: ThemeId): Promise<void>;
  subscribe(listener: (id: ThemeId) => void): () => void;
}
