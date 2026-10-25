/** Pure color/model logic shared by the browser and the Node build. No React, IO or application state. */
export const COLOR_ROLES = ['canvas', 'shell', 'surface', 'raised', 'high', 'well', 'textPrimary', 'textSecondary', 'textMuted', 'accent', 'action', 'actionHover', 'link', 'linkHover', 'focus', 'divider', 'control', 'sceneIdle'];
const HEX = /^#[0-9a-f]{6}$/i;
export const rgbChannels = color => color.slice(1).match(/../g).map(part => parseInt(part, 16)).join(', ');
export function mixColor(from, to, amount) {
  const a = rgbChannels(from).split(',').map(Number), b = rgbChannels(to).split(',').map(Number);
  return '#' + a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function contrastRatio(a, b) {
  const luminance = color => rgbChannels(color).split(',').map(Number).map(value => value / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}
export function resolveTheme(raw, modes) {
  if (!raw || typeof raw.id !== 'string' || raw.id.length > 64 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(raw.id)
    || ['constructor','prototype','__proto__'].includes(raw.id) || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 100
    || typeof raw.description !== 'string' || !raw.description.trim() || raw.description.length > 200 || !['dark', 'light'].includes(raw.mode)) throw new Error('Invalid theme identity');
  const keys = Object.keys(raw.colors ?? {});
  if (keys.length !== COLOR_ROLES.length || COLOR_ROLES.some(role => !keys.includes(role))) throw new Error(`${raw.id}: incomplete or unknown color roles`);
  if (keys.some(role => !HEX.test(raw.colors[role]))) throw new Error(`${raw.id}: expected six-digit hex colors`);
  const defaults = modes[raw.mode];
  if (!defaults || Object.keys(defaults).length !== 5 || ['success','warning','danger','info','overlay'].some(role => !HEX.test(defaults[role]))) throw new Error('Invalid shared mode colors');
  const colors = { ...raw.colors, ...defaults, onAction: '#FFFFFF', selected: mixColor(raw.colors.canvas, raw.colors.accent, raw.mode === 'light' ? .09 : .17), selectedContent: raw.colors.link,
    code: raw.colors.well, codeContent: raw.colors.textPrimary,
    diffAdded: mixColor(raw.colors.well, defaults.success, raw.mode === 'light' ? .07 : .09), diffAddedContent: defaults.success,
    diffRemoved: mixColor(raw.colors.well, defaults.danger, raw.mode === 'light' ? .05 : .08), diffRemovedContent: defaults.danger,
    diffHunk: defaults.info };
  const scene = { background: colors.shell, hub: colors.accent, hubEmissive: colors.action, idle: colors.sceneIdle,
    orbit: colors.link, ring: colors.focus, wave: colors.accent, waveActive: colors.link, highlight: raw.mode === 'light' ? colors.textPrimary : '#F5F3FF',
    glow: colors.link, labelBackground: colors.surface, labelForeground: colors.textPrimary,
    success: colors.success, warning: colors.warning, danger: colors.danger, info: colors.info };
  return { id: raw.id, name: raw.name, description: raw.description, mode: raw.mode, colors, scene };
}
export function cssVariables(theme) {
  const variables = {};
  const kebab = name => name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
  for (const [role, color] of Object.entries(theme.colors)) if (HEX.test(color)) variables['--ui-' + kebab(role)] = rgbChannels(color).replaceAll(',', '');
  const c = theme.colors;
  const aliases = { white: theme.mode === 'dark' ? '#FFFFFF' : c.textPrimary, 'on-accent': c.onAction, canvas: c.canvas, shell: c.shell, surface: c.surface, raised: c.raised, 'raised-2': c.high, well: c.well, glass: c.surface, scrollbar: theme.mode === 'dark' ? '#FFFFFF' : c.textPrimary };
  for (const [role, color] of Object.entries(aliases)) variables['--c-' + role] = rgbChannels(color).replaceAll(',', '');
  return variables;
}
