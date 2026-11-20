import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

import { canToggleRequest, conversationChatMessages, parseConversation, parseConversationRequests, type ConversationRequest } from './projectConversation';
import { ProjectConversationView } from './ProjectConversationView';
import { PmClientsView } from './PmClientsPage';
import type { PmClientSummary } from './pmApi';
import { clientIdFromKey } from './PmClientConversation';

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

  it('shows requests as cards, tags messages with their request, and events as lines from the reader’s side', () => {
    const forClient = conversationChatMessages(parseConversation(timeline).items, 'client');
    expect(forClient.map(m => m.kind ?? 'message')).toEqual(['message', 'request', 'message', 'event', 'event']);
    expect(forClient[0].tag).toBe('Project proposal');
    expect(forClient[1]).toMatchObject({ heading: 'Add a contact form', tag: 'New request' });
    expect(forClient[2].tag).toBe('Re: Add a contact form');
    expect(forClient[3].body).toBe('Your project manager added a task for “Add a contact form”: Build the form');
    expect(forClient[4].body).toBe('You marked “Add a contact form” done');
    const forPm = conversationChatMessages(parseConversation(timeline).items, 'pm');
    expect(forPm[3].body).toBe('WEB-4 “Build the form” was linked to “Add a contact form”');
    expect(forPm[4].body).toBe('The client marked “Add a contact form” done');
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
    for (const shown of ['Requests · 1 open', 'Add a contact form', 'In progress', 'Build the form', 'New request', 'Which pages?', 'Mark done: Add a contact form']) {
      expect(html).toContain(shown);
    }
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
    for (const label of ['Requests · 1 open', ...tabs.map(tab => tab.label)]) expect(html).toContain(`>${label}</button>`);
    expect(html).not.toContain('>About</button>');
    expect(view()).toContain('>About</button>');
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
