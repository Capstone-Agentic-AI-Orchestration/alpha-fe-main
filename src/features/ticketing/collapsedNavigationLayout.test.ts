import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * A collapsed side list is a 48px grid track beside an open ticket, request or
 * inquiry. If that track can apply with nothing open, the page itself is the
 * first grid child and is squeezed into 48px: text wraps one letter per line
 * and the filters spill sideways. The collapse preference outlives the open
 * item, so every such rule must also require the "something is open" class.
 */
const STYLESHEETS = ['pmTickets.css', 'chatWorkspace.css'];
const OPEN_CLASSES = ['pm-tickets--ticket-open', 'has-selected-request', 'pm-inquiries--selected'];

function narrowRailSelectors(css: string): string[] {
  const selectors: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (let match = rule.exec(css); match; match = rule.exec(css)) {
    const [, selectorText, body] = match;
    if (!/grid-template-columns:\s*48px\b/.test(body)) continue;
    selectors.push(...selectorText.replace(/\/\*[\s\S]*?\*\//g, '').split(',').map(part => part.trim()).filter(Boolean));
  }
  return selectors;
}

describe('collapsed side lists', () => {
  for (const file of STYLESHEETS) {
    it(`only narrow to a rail while an item is open (${file})`, () => {
      const css = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      for (const selector of narrowRailSelectors(css)) {
        expect(OPEN_CLASSES.some(name => selector.includes(name)), `"${selector}" in ${file} can narrow the page with nothing open`).toBe(true);
      }
    });
  }
});
