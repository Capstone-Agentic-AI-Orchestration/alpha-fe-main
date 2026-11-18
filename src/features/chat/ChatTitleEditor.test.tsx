import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/app/AppContext', () => ({ useApp: () => ({}) }));

import { ChatTitleEditor, chatTitleToSave } from './ChatTitleEditor';

describe('renaming a chat from its header', () => {
  it('saves a tidied new name, and nothing for a blank, unchanged or too long one', () => {
    expect(chatTitleToSave('  Landing   page plan ', 'hello')).toBe('Landing page plan');
    expect(chatTitleToSave('   ', 'hello')).toBeNull();
    expect(chatTitleToSave(' hello ', 'hello')).toBeNull();
    expect(chatTitleToSave('x'.repeat(121), 'hello')).toBeNull();
    expect(chatTitleToSave('x'.repeat(120), 'hello')).toBe('x'.repeat(120));
  });

  it('offers the name as a rename button where renaming is allowed', () => {
    const html = renderToStaticMarkup(<ChatTitleEditor title="hello" onRename={vi.fn()} />);
    expect(html).toMatch(/<button[^>]*title="Rename chat"[^>]*>hello<\/button>/);
  });

  it('shows plain text where renaming is not allowed', () => {
    const html = renderToStaticMarkup(<ChatTitleEditor title="hello" />);
    expect(html).not.toContain('<button');
    expect(html).toContain('>hello</h1>');
  });
});
