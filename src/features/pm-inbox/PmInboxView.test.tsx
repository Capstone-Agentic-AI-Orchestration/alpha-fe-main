import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { InboxItem } from './inboxItems';

vi.mock('@/app/AppContext', () => ({ useApp: () => ({}), useTabSessionState: (_key: string, value: unknown) => [value, () => {}] }));
const { PmInboxLayout } = await import('./PmInboxView');

const item = (id: string, turn: 'pm' | 'client', extra: Partial<InboxItem> = {}): InboxItem => ({ id, kind: 'inquiry', label: 'Inquiry', tone: 'info',
  title: 'Request ' + id, who: 'Someone', turn, nextStep: 'Start a project or reply', target: { view: 'inquiries', inquiryId: id }, ...extra });
const render = (items: InboxItem[], filter: 'all' | 'waiting' = 'all') => renderToStaticMarkup(<PmInboxLayout items={items} filter={filter}
  onFilter={() => {}} selectedId={null} onSelect={() => {}} loading={false} incomplete={false} onRefresh={() => {}} onOpen={() => {}} />);

describe('the Inbox page', () => {
  it('counts each filter and opens the first request', () => {
    const html = render([item('a', 'pm', { detail: 'Rooms and deposits.' }), item('b', 'client')]);
    expect(html).toContain('All · 1');
    expect(html).toContain('Waiting on client · 1');
    expect(html).toContain('What they asked for');
    expect(html).toContain('Open the inquiry');
  });

  it('says when nothing needs the project manager', () => {
    expect(render([item('b', 'client')])).toContain('Nothing needs you right now.');
    expect(render([], 'waiting')).toContain('Nothing is waiting on a client.');
  });
});

