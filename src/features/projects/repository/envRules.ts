/**
 * Hosting-variable rules the editor applies before anything is sent. The
 * server applies the same ones again; these exist so a mistake is shown next
 * to the field instead of after a round trip.
 */

export const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]{0,127}$/;
export const MAX_ENV_VALUE_LENGTH = 16_384;
const RESERVED_PREFIXES = ['VERCEL_', 'RENDER_'];

export interface EnvRow {
  key: string;
  value: string;
}

/** Why `key` cannot be written, or null. `managed` are the keys Alpha sets itself. */
export function envKeyProblem(key: string, managed: ReadonlySet<string>): string | null {
  if (!key) return 'Name required.';
  if (!ENV_KEY_PATTERN.test(key)) return 'Use A–Z, 0–9 and _, not starting with a digit.';
  if (managed.has(key)) return 'Set by Alpha from the paired repository.';
  if (RESERVED_PREFIXES.some(prefix => key.startsWith(prefix))) return 'Reserved by the hosting platform.';
  return null;
}

/** The first problem with a set of rows as a whole, or null when they can be saved. */
export function envRowsProblem(rows: readonly EnvRow[], managed: ReadonlySet<string>): string | null {
  if (rows.length === 0) return 'Add at least one variable.';
  const seen = new Set<string>();
  for (const row of rows) {
    const problem = envKeyProblem(row.key, managed);
    if (problem) return `${row.key || 'A variable'}: ${problem}`;
    if (seen.has(row.key)) return `${row.key} is listed twice.`;
    seen.add(row.key);
    if (!row.value) return `${row.key} needs a value.`;
    if (row.value.length > MAX_ENV_VALUE_LENGTH) return `${row.key} is longer than ${MAX_ENV_VALUE_LENGTH} characters.`;
  }
  return null;
}

/**
 * Rows from pasted `.env` text, parsed here in the browser -- the text itself
 * is never sent anywhere. Comments and blank lines are skipped, `export ` is
 * dropped, and a value in matching quotes is unquoted. Later duplicates win,
 * as they would in a shell, and are reported.
 */
export function parseEnvText(text: string): { rows: EnvRow[]; duplicates: string[]; skipped: number } {
  const byKey = new Map<string, string>();
  const duplicates = new Set<string>();
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const body = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eq = body.indexOf('=');
    if (eq <= 0) {
      skipped += 1;
      continue;
    }
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value[value.length - 1] === value[0]) {
      value = value.slice(1, -1);
    }
    if (byKey.has(key)) duplicates.add(key);
    byKey.set(key, value);
  }
  return { rows: [...byKey].map(([key, value]) => ({ key, value })), duplicates: [...duplicates], skipped };
}
