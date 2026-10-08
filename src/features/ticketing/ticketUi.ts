export const primary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-on-accent hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40';
export const secondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40';
export const input = 'w-full rounded-lg border border-white/10 bg-well px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-brand-400';
export const panels = ['Conversation', 'Scope', 'Documents', 'Delivery'] as const;
export type DetailPanel = (typeof panels)[number];
export const time = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
