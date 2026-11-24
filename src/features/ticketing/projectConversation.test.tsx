import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

import { canToggleRequest, conversationChatMessages, parseConversation, parseConversationRequests, type ConversationRequest } from './projectConversation';
import { ProjectConversationChat, ProjectConversationView } from './ProjectConversationView';
import { PmClientsView } from './PmClientsPage';
import type { PmClientSummary } from './pmApi';
import { clientIdFromKey } from './PmClientConversation';
import { PmConversationRail } from './PmConversationRail';

const request = { ticketId: 't-1', reference: 'TKT-1', title: 'Add a contact form' };
const timeline = { items: [
  { id: 'ce:1', kind: 'clarification', author: 'pm', body: 'Which pages?', createdAt: '2026-11-01T09:00:00Z', request, task: null },
  { id: 'request:t-1', kind: 'request', author: 'client', body: 'A form on the About page.', createdAt: '2026-11-01T10:00:00Z', request, task: null },
  { id: 'tm:1', kind: 'message', author: 'pm', body: 'On it.', createdAt: '2026-11-01T11:00:00Z', request, task: null },
  { id: 'tl:i-1', kind: 'task_linked', author: 'pm', body: '', createdAt: '2026-11-01T12:00:00Z', request, task: { issueId: 'i-1', identifier: 'WEB-4', title: 'Build the form' } },
  { id: 'ck:t-1', kind: 'request_done', author: 'client', body: '', createdAt: '2026-11-02T12:00:00Z', request, task: null },
] };
const openRequest: ConversationRequest = { ticketId: 't-1', workspaceId: 'w', reference: 'TKT-1', title: 'Add a contact form',
  description: 'A form on the About page.', ticketStatus: 'under_review', checklist: 'in_progress', doneBy: null, doneAt: null,
  createdAt: '2026-11-01T10:00:00Z', linkedTasks: [{ issueId: 'i-1', identifier: 'WEB-4', title: 'Build the form', status: 'todo' }] };

describe('project conversation data', () => {
  it('parses the conversation and rejects malformed rows', () => {
    expect(parseConversation({ ...timeline, clientId: 'c' }).items).toHaveLength(5);
    expect(parseConversation({ ...timeline, clientId: 'c' }).clientId).toBe('c');
    expect(() => parseConversation({ items: [{ id: 'x', kind: 'gossip', author: 'pm', body: '', createdAt: 'now' }] })).toThrow();
    expect(parseConversationRequests({ items: [openRequest] }).items[0]).toEqual(openRequest);
    expect(() => parseConversationRequests({ items: [{ ...openRequest, checklist: 'maybe' }] })).toThrow();
  });

  it('shows requests as cards, quotes the request a reply is about, and events as lines from the reader’s side', () => {
    const forClient = conversationChatMessages(parseConversation(timeline).items, 'client');
    expect(forClient.map(m => m.kind ?? 'message')).toEqual(['message', 'request', 'message', 'event']);
    expect(forClient[0].tag).toBe('Project proposal');
    expect(forClient[0].replyTo).toBeUndefined();
    expect(forClient[1]).toMatchObject({ kind: 'request', heading: 'Add a contact form', reference: 'TKT-1' });
    // A reply about a request quotes it, pointing at its card, the way a messaging app quotes the message answered.
    const quote = { id: 'request:t-1', title: 'Add a contact form', excerpt: 'A form on the About page.' };
    expect(forClient[2]).toMatchObject({ body: 'On it.', replyTo: quote });
    expect(forClient[2].tag).toBeUndefined();
    expect(forClient[3].body).toBe('You marked “Add a contact form” done');
    const forPm = conversationChatMessages(parseConversation(timeline).items, 'pm');
    // Both sides see the same quote, whoever wrote the reply.
    expect(forPm[2].replyTo).toEqual(quote);
    expect(forPm[3].body).toBe('WEB-4 “Build the form” was linked to “Add a contact form”');
    expect(forPm[4].body).toBe('The client marked “Add a contact form” done');
  });

  it('shortens a long request to a one-line quote', () => {
    const long = 'word '.repeat(60);
    const items = parseConversation({ items: [
      { ...timeline.items[1], body: long },
      { ...timeline.items[2], author: 'client' },
    ] }).items;
    const excerpt = conversationChatMessages(items, 'pm')[1].replyTo?.excerpt ?? '';
    expect(excerpt.length).toBeLessThanOrEqual(140);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt).not.toMatch(/\s{2}/);
  });

  it('lets a request be ticked unless it was declined or is formally finished', () => {
    expect(canToggleRequest(openRequest)).toBe(true);
    expect(canToggleRequest({ ...openRequest, checklist: 'done', ticketStatus: 'under_review' })).toBe(true);
    expect(canToggleRequest({ ...openRequest, checklist: 'done', ticketStatus: 'closed' })).toBe(false);
    expect(canToggleRequest({ ...openRequest, checklist: 'declined' })).toBe(false);
  });

  it('reads the client account from a client page key', () => {
    expect(clientIdFromKey('client:abc')).toBe('abc');
    expect(clientIdFromKey('ticket:abc')).toBeNull();
  });
});

describe('ProjectConversationView', () => {
  const view = (props: Partial<Parameters<typeof ProjectConversationView>[0]> = {}) => renderToStaticMarkup(<ProjectConversationView
    role="client" projectName="Website" items={parseConversation(timeline).items} requests={[openRequest]} draft="" onDraftChange={() => undefined}
    onSend={() => undefined} onToggleDone={() => undefined} inputId="test" {...props} />);

  it('shows the chat and the requests checklist with linked tasks', () => {
    const html = view({ onCreateRequest: async () => true });
    for (const shown of ['Requests · 1 open', 'Add a contact form', 'In progress', 'New request', 'Which pages?', 'Mark done: Add a contact form']) {
      expect(html).toContain(shown);
    }
    expect(html).not.toContain('Build the form');
    expect(html).not.toContain('WEB-4</span>');
  });

  it('gives the PM task identifiers and request actions, and no New request', () => {
    const html = view({ role: 'pm', renderRequestActions: () => <button type="button">Create task</button> });
    expect(html).toContain('WEB-4');
    expect(html).toContain('Create task');
    expect(html).not.toContain('New request</button>');
  });

  it('keeps the PM request context tabs beside Requests instead of the About tab', () => {
    const tabs = ['Overview', 'Private notes', 'Request details', 'Documents'].map(label => ({ id: label, label, content: null }));
    const html = view({ role: 'pm', panelTabs: tabs });
    for (const label of ['Tickets · 1 open', ...tabs.map(tab => tab.label)]) expect(html).toContain(`>${label}</button>`);
    expect(html).not.toContain('>About</button>');
    expect(view()).toContain('>About</button>');
  });

  it('renders a plain ticket picker followed by separate selected-ticket details', () => {
    const second: ConversationRequest = { ...openRequest, ticketId: 't-2', reference: 'TKT-123ABC987654', title: 'Fix the footer', linkedTasks: [] };
    const html = view({ role: 'pm', requests: [openRequest, second], selectedTicketId: 't-2',
      conversationHeader: <header>Project header</header>,
      renderRail: ({ requestList, requestsTitle }) => <PmConversationRail projectName="Website" previewShared={false}
        ticketsTitle={requestsTitle} tickets={requestList} selected={<section aria-label="Selected ticket details">Details for Fix the footer</section>} /> });
    const rail = html.slice(html.indexOf('<aside'));
    const list = rail.slice(rail.indexOf('<ul'), rail.indexOf('</ul>'));
    expect(html).not.toContain('role="tablist"');
    expect(html.indexOf('Project header')).toBeLessThan(html.indexOf('<aside'));
    expect(rail.indexOf('</ul>')).toBeLessThan(rail.indexOf('Details for Fix the footer'));
    expect(list.match(/class="pm-rail-ticket-row"/g)).toHaveLength(2);
    expect(list).toContain('aria-pressed="true"');
    expect(list).toContain('aria-pressed="false"');
    expect(list).not.toContain('aria-expanded');
    expect(list).not.toContain('Mark done');
    expect(list).toContain('>TKT-123ABC<');
    expect(list).toContain('title="TKT-123ABC987654"');
    expect(rail).not.toContain('Open details');
  });
});

describe('ProjectConversationChat', () => {
  const chat = (props: Partial<Parameters<typeof ProjectConversationChat>[0]> = {}) => renderToStaticMarkup(<ProjectConversationChat
    role="pm" items={parseConversation(timeline).items} requests={[openRequest]} draft="" onDraftChange={() => undefined}
    onSend={() => undefined} inputId="test" {...props} />);

  it('draws a request as its own card with its reference and status, not as a message bubble', () => {
    const html = chat();
    expect(html).toMatch(/<article class="ticket-chat__request"[^>]*data-chat-id="request:t-1"/);
    for (const shown of ['Request', 'TKT-1', 'In progress', 'Requested by Client']) expect(html).toContain(shown);
    expect(html).toContain('data-chat-id="tm:1"');
  });

  it('draws a reply’s quoted request above its bubble, on both sides, as a button back to the request', () => {
    for (const role of ['pm', 'client'] as const) {
      const html = chat({ role });
      const reply = html.slice(html.indexOf('data-chat-id="tm:1"'));
      expect(reply).toContain('Replied to a request');
      expect(reply).toMatch(/<button type="button" class="ticket-chat__reply"[^>]*aria-label="Replied to request: Add a contact form. Show the request"/);
      expect(reply.indexOf('ticket-chat__reply')).toBeLessThan(reply.indexOf('On it.'));
      expect(reply).not.toContain('Re: Add a contact form');
    }
  });

  it('offers request actions on request cards only', () => {
    const html = chat({ messageActions: item => item.kind === 'request' ? <button type="button">Create task</button> : null });
    expect(html.match(/Create task/g)).toHaveLength(1);
    expect(html).toMatch(/ticket-chat__request-foot[\s\S]*Create task/);
  });

  it('shows which request a reply goes to, or offers it back when writing to the whole project', () => {
    const about = { ticketId: 't-1', title: 'Add a contact form' };
    expect(chat({ about, onClearAbout: () => undefined })).toContain('Stop replying about Add a contact form');
    expect(chat({ about, onClearAbout: () => undefined })).toContain('Replying to');
    expect(chat({ restoreAbout: about, onRestoreAbout: () => undefined })).toContain('Reply about “Add a contact form” instead');
  });
});

describe('client page with one conversation per project', () => {
  const ana: PmClientSummary = { key: 'client:ana', displayName: 'Ana Cruz', company: null, access: 'active',
    tickets: { needsPm: 2, waitingClient: 0, open: 3, closed: 1, unlinkedOpen: 0, accessRevoked: 0 },
    projects: [{ projectId: 'p1', name: 'Website', previewPublished: false }], lastActivityAt: '2026-11-01T00:00:00Z' };
  const render = (section: Parameters<typeof PmClientsView>[0]['section']) => renderToStaticMarkup(<PmClientsView clients={[ana]} error="" loading={false}
    search="" onSearch={() => undefined} selectedKey="client:ana" onSelect={() => undefined} section={section} onSection={() => undefined}
    knownProjectIds={new Set()} onOpenProject={() => undefined} onOpenInquiries={() => undefined}
    renderTickets={() => <p>Request page</p>} renderConversation={() => <p>Conversation body</p>}
    renderConversations={() => <p>Old conversations</p>} renderOverview={() => <p>Overview body</p>} />);

  it('replaces the Tickets and Conversations tabs with one Conversation tab', () => {
    const html = render('overview');
    expect(html).toContain('>Conversation<');
    expect(html).not.toContain('>Tickets<');
    expect(html).not.toContain('>Conversations<');
    expect(render('conversations')).toContain('Conversation body');
  });

  it('opens a request’s full page under Conversation, with a way back', () => {
    const html = render('tickets');
    expect(html).toContain('Request page');
    expect(html).toContain('Back to conversation');
    expect(html).toMatch(/aria-selected="true"[^>]*>Conversation/);
  });
});
