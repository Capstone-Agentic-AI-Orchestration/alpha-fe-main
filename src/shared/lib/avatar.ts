/**
 * Deterministic identity art for agents.
 *
 * Creation used to mint `images.unsplash.com/photo-${1500000000000 + random()}`
 * — an ID that almost never resolves to a real photo, so most agents shipped
 * with a broken image, and re-creating the same agent produced a different one.
 * An inline SVG needs no network, cannot 404, and gives the same agent the same
 * face every time.
 */

/** Same hues the rest of the app uses for status and accent work. */
const PALETTE = [
  '#6366f1', // brand indigo
  '#22d3ee', // cyan
  '#34d399', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#a78bfa', // violet
  '#38bdf8', // sky
  '#fb923c' // orange
];

/** FNV-1a, so the same name lands on the same colour across reloads and machines. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function agentColor(name: string): string {
  return PALETTE[hash(name) % PALETTE.length];
}

/** First letter of the first two words — "Aegis Sentinel" → "AS". */
export function agentInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.slice(0, 2).map(w => [...w][0] ?? '');
  return letters.join('').toUpperCase();
}

/**
 * An `<img src>`-ready avatar. Encoded with `encodeURIComponent` rather than
 * base64 so it stays greppable and avoids the unicode pitfalls of `btoa` —
 * initials can be non-Latin.
 */
export function agentAvatarDataUri(name: string, color = agentColor(name)): string {
  const initials = agentInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
<rect width="96" height="96" rx="48" fill="${color}" fill-opacity="0.18"/>
<circle cx="48" cy="48" r="46" fill="none" stroke="${color}" stroke-opacity="0.5" stroke-width="2"/>
<text x="48" y="49" fill="${color}" font-family="DM Sans, system-ui, sans-serif" font-size="34" font-weight="600" text-anchor="middle" dominant-baseline="central">${initials}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
