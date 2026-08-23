/**
 * Namespaced localStorage access.
 *
 * Lived inside AppContext until agent drafts needed the same thing. Sharing it
 * matters mostly for the prefix: two modules inventing their own would put keys
 * in the same namespace under different names, and "clear Alpha's cache" would
 * quietly miss half of them.
 */

const STORAGE_PREFIX = 'alpha_multica_';

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    if (!item) return fallback;

    const parsed = JSON.parse(item);

    // A stored literal `null` parses to null and used to be returned as-is,
    // so `agents`/`issues` could become null and every `.map`/`[0]` on them
    // threw during render — a blank screen with no clue why.
    if (parsed === null || parsed === undefined) return fallback;

    // Guard the shape too: a value written by an older build (an array where
    // an object is now expected, or the reverse) fails the same way.
    if (Array.isArray(fallback) !== Array.isArray(parsed)) {
      console.warn(`[storage] ignoring "${key}": shape no longer matches`);
      return fallback;
    }

    // Drop null/undefined ENTRIES inside a cached list. A single bad element —
    // an interrupted write, a record from a build with a different shape — makes
    // every `entry.name` in a render loop throw, which unmounts the whole tree
    // and shows a blank page. Losing one row beats losing the app.
    if (Array.isArray(parsed)) {
      const clean = parsed.filter(entry => entry !== null && entry !== undefined);
      if (clean.length !== parsed.length) {
        console.warn(`[storage] dropped ${parsed.length - clean.length} empty entr(ies) from "${key}"`);
      }
      return clean as T;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}
