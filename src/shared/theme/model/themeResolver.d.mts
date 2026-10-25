import type { ResolvedTheme, ThemeColorRole } from './types';
export const COLOR_ROLES: readonly ThemeColorRole[];
export function rgbChannels(color: string): string;
export function mixColor(from: string, to: string, amount: number): string;
export function contrastRatio(a: string, b: string): number;
export function resolveTheme(raw: unknown, modes: unknown): ResolvedTheme;
export function cssVariables(theme: ResolvedTheme): Record<string, string>;
