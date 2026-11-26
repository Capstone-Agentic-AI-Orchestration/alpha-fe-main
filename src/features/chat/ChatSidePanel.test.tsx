import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => {
  const storage = new Map<string, string>();
  (globalThis as { window?: unknown }).window ??= globalThis;
  (globalThis as { localStorage?: unknown }).localStorage ??= { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) };
});

import { ChatSidePanel } from './ChatSidePanel';

const tabs = [{ id: 'changes:run-1', title: 'Changes', icon: null }];
const render = (variant: 'sheet' | 'inset') => renderToStaticMarkup(<ChatSidePanel variant={variant} tabs={tabs} activeId="changes:run-1"
  onSelect={() => undefined} onClose={() => undefined} onCloseAll={() => undefined}><p>diff</p></ChatSidePanel>);

describe('the sheet beside the chat', () => {
  it('shows one thing with its title and a close button, and no tab strip', () => {
    const html = render('sheet');
    expect(html).toMatch(/<h2[^>]*>.*Changes.*<\/h2>/);
    expect(html).toContain('aria-label="Close Changes"');
    expect(html).toContain('title="Close (Esc)"');
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('role="tabpanel"');
    expect(html).toContain('<p>diff</p>');
  });

  it('keeps the tab strip where tabs are still used', () => {
    expect(render('inset')).toContain('role="tablist"');
  });
});
