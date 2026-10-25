export const primary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-action px-3.5 py-2 text-sm font-medium text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-40';
export const secondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-divider bg-surface-raised px-3 py-2 text-sm text-content-secondary hover:bg-surface-high disabled:cursor-not-allowed disabled:opacity-40';
export const input = 'w-full rounded-lg border border-control bg-well px-3 py-2.5 text-sm text-content placeholder:text-content-muted focus:border-control focus:outline-none focus:ring-2 focus:ring-focus';
export const panels = ['Conversation', 'Scope', 'Documents', 'Delivery'] as const;
export type DetailPanel = (typeof panels)[number];
export const time = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
