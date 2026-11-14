import { useLayoutEffect, useRef, useState } from 'react';

/** The height available to a list that must fit its container instead of scrolling. */
export function useFitHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const update = () => setHeight(element.clientHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, height] as const;
}

export const ROW_HEIGHT = 32;
export const LABEL_HEIGHT = 28;

export interface FitEntry { key: string; height: number; label?: boolean }

/** Take entries in order until the budget is spent; never end on a bare section label. */
export function fitEntries<T extends FitEntry>(entries: T[], budget: number): T[] {
  const shown: T[] = [];
  let used = 0;
  for (const entry of entries) {
    if (used + entry.height > budget) break;
    shown.push(entry);
    used += entry.height;
  }
  while (shown.at(-1)?.label) shown.pop();
  return shown;
}

export const entriesHeight = (entries: FitEntry[]) => entries.reduce((sum, entry) => sum + entry.height, 0);
