import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Ticketing modules read `window` when they load; this suite renders to static markup in Node.
vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });
vi.mock('@/app/AppContext', () => ({ useApp: () => ({}), useTabSessionState: <T,>(_key: string, initial: T) => [initial, () => undefined] }));
vi.mock('./PmTicketsView', () => ({ PmTicketsView: () => null }));

import { ApiRequestError } from '@/shared/services/apiService';
import { PmClientsView, clientInitials, clientNeedsYou, clientsLoadError, proposalsLoadError, clientsSummary, filterClients, type PmClientsViewProps } from './PmClientsPage';
import type { PmClientSummary } from './pmApi';

const ana: PmClientSummary = {
  key: 'client:ana', displayName: 'Ana Cruz', company: 'Resort Co', access: 'active',
  tickets: { needsPm: 2, waitingClient: 0, open: 3, closed: 1, unlinkedOpen: 1, accessRevoked: 1 },
  projects: [
    { projectId: 'gh-repo-1', name: 'Resort Website', previewPublished: true },
    { projectId: 'gh-repo-9', name: 'Hidden Project', previewPublished: false },
  ],
  lastActivityAt: '2026-11-15T10:00:00.000Z',
};
const ben: PmClientSummary = {
  key: 'client:ben', displayName: 'Ben Go', company: null, access: 'inactive',
  tickets: { needsPm: 0, waitingClient: 0, open: 0, closed: 2, unlinkedOpen: 0, accessRevoked: 0 },
  projects: [], lastActivityAt: '2026-11-01T10:00:00.000Z',
};

const render = (props: Partial<PmClientsViewProps> = {}) => renderToStaticMarkup(<PmClientsView
  clients={[ana, ben]} error="" loading={false} search="" onSearch={() => undefined}
  selectedKey={null} onSelect={() => undefined} section="tickets" onSection={() => undefined}
  knownProjectIds={new Set(['gh-repo-1'])} onRefresh={() => undefined} onOpenProject={() => undefined}
  onOpenInquiries={() => undefined} renderTickets={key => <p>Tickets for {key}</p>}
  renderConversation={() => <p>Project conversation</p>} {...props} />);

describe('Clients list', () => {
  it('lists each client with company, what needs the PM, and access', () => {
    const html = render();
    for (const shown of ['Clients', 'Ana Cruz', 'Resort Co', 'Ben Go', 'Needs you', 'Active', 'Off']) expect(html).toContain(shown);
    expect(html.indexOf('Ana Cruz')).toBeLessThan(html.indexOf('Ben Go'));
  });

  it('filters by name or company', () => {
    expect(render({ search: 'resort' })).not.toContain('Ben Go');
    expect(render({ search: 'nobody' })).toContain('No clients match');
  });

  it('points to Inquiries when there are no clients yet', () => {
    const html = render({ clients: [] });
    expect(html).toContain('Clients appear here once they have a portal account.');
    expect(html).toContain('Open Inquiries');
  });

  it('shows the load error instead of the list', () => {
    const html = render({ clients: null, error: 'The Alpha cloud can’t be reached right now.' });
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Ana Cruz');
  });
});

describe('A client’s page', () => {
  it('shows the client’s projects and project conversation without a separate Tickets tab', () => {
    const html = render({ selectedKey: 'client:ana', section: 'conversation' });
    for (const shown of ['All clients', 'Ana Cruz', 'Projects', 'Conversation', 'Access', 'Portal access on', 'Project conversation']) expect(html).toContain(shown);
    expect(html).not.toContain('>Tickets<');
  });

  it('links only to projects in the PM’s project list, and notes unlinked requests', () => {
    const html = render({ selectedKey: 'client:ana', section: 'projects' });
    expect(html).toContain('Resort Website');
    expect(html).toContain('Hidden Project');
    expect(html.match(/Open conversation/g)).toHaveLength(1);
    expect(html).toContain('Preview shared with the client');
    expect(html).toContain('1 open request isn’t linked to a project yet.');
  });

  it('shows portal access and requests where it was removed', () => {
    const html = render({ selectedKey: 'client:ana', section: 'access' });
    expect(html).toContain('Can sign in to the client portal');
    expect(html).toContain('Access was removed on 1 request.');
    expect(render({ selectedKey: 'client:ben', section: 'access' })).toContain('Portal access is off.');
  });

  it('falls back to the list for a client that is not loaded', () => {
    expect(render({ selectedKey: 'client:gone' })).toContain('Needs you');
  });
});

describe('Load errors', () => {
  it.each([
    [503, 'connection to your team’s Alpha cloud workspace'],
    [502, 'can’t be reached'],
    [404, 'isn’t available on the server yet'],
    [403, 'Only project managers'],
  ])('explains a %i', (status, text) => {
    expect(clientsLoadError(new ApiRequestError(status, 'x'))).toContain(text);
  });
  it('has a generic message for anything else', () => {
    expect(clientsLoadError(new Error('boom'))).toContain('could not be loaded');
  });
});

describe('A client’s added tabs', () => {
  const tabs = {
    renderOverview: () => <p>Overview body</p>,
    renderConversations: () => <p>Conversations body</p>,
    renderDocuments: () => <p>Documents body</p>,
  };
  it('lists Overview, Projects, Conversation, Documents, and Access in order', () => {
    const html = render({ selectedKey: 'client:ana', section: 'overview', ...tabs });
    const order = ['Overview', '>Projects<', '>Conversation<', 'Documents', '>Access<'].map(label => html.indexOf(label));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('Overview body');
  });
  it.each([['conversation', 'Project conversation'], ['documents', 'Documents body']] as const)('renders the %s tab', (section, body) => {
    expect(render({ selectedKey: 'client:ana', section, ...tabs })).toContain(body);
  });
  it('hides conversation history and request tabs in the project-scoped view', () => {
    const html = render({ selectedKey: 'client:ana', section: 'overview' });
    expect(html).not.toContain('>Conversations<');
    expect(html).not.toContain('>Tickets<');
  });
});

describe('Client list upgrades', () => {
  it('shows initials and the projects a client can see', () => {
    const html = render();
    expect(html).toContain('>AC<');
    expect(html).toContain('Resort Co · Resort Website, Hidden Project');
  });

  it('searches project names as well as names and companies', () => {
    expect(filterClients([ana, ben], 'resort website', false).map(client => client.key)).toEqual(['client:ana']);
    expect(filterClients([ana, ben], 'ben', false).map(client => client.key)).toEqual(['client:ben']);
  });

  it('keeps only clients needing the PM when Needs you is on', () => {
    expect(filterClients([ana, ben], '', true).map(client => client.key)).toEqual(['client:ana']);
    const html = render({ needsYouOnly: true, onNeedsYouOnly: () => undefined });
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('Ben Go');
  });

  it('offers a way back when nobody needs the PM', () => {
    const html = render({ clients: [ben], needsYouOnly: true, onNeedsYouOnly: () => undefined });
    expect(html).toContain('No clients need you right now.');
    expect(html).toContain('Show all clients');
  });

  it('hides the toggle when the parent does not handle it', () => {
    expect(render()).not.toContain('aria-pressed');
  });

  it('summarizes what is waiting across clients', () => {
    expect(clientsSummary([ana, ben])).toBe('1 client needs you');
    expect(clientsSummary([{ ...ana, tickets: { ...ana.tickets, waitingClient: 2 } }, { ...ben, tickets: { ...ben.tickets, needsPm: 1 } }]))
      .toBe('2 clients need you · 2 requests are waiting on the client');
    expect(clientsSummary([ben])).toBe('');
    expect(render()).toContain('1 client needs you');
  });

  it('makes initials from up to two words', () => {
    expect(clientInitials('Ana Maria Cruz')).toBe('AM');
    expect(clientInitials('  ')).toBe('?');
  });
});

describe('Unread client replies', () => {
  const benUnread: PmClientSummary = { ...ben, tickets: { ...ben.tickets, unreadReplies: 2 } };
  it('counts an unread reply as needing the PM', () => {
    expect(clientNeedsYou(benUnread)).toBe(true);
    expect(clientNeedsYou(ben)).toBe(false);
    expect(filterClients([ana, benUnread], '', true).map(client => client.key)).toEqual(['client:ana', 'client:ben']);
  });
  it('adds unread replies to the summary and the row', () => {
    expect(clientsSummary([ana, benUnread])).toBe('2 clients need you · 2 unread replies');
    expect(render({ clients: [benUnread] })).toContain('2 unread');
  });
  it('shows nothing for a server that does not report unread replies', () => {
    expect(render({ clients: [ben] })).not.toContain('unread');
  });
});

describe('Proposals tab', () => {
  it('appears after Documents when provided', () => {
    const html = render({ selectedKey: 'client:ana', section: 'proposals', renderDocuments: () => <p>Docs</p>, renderProposals: () => <p>Proposal list</p> });
    expect(html).toContain('Proposal list');
    expect(html.indexOf('>Documents<')).toBeLessThan(html.indexOf('>Proposals<'));
    expect(render({ selectedKey: 'client:ana', section: 'tickets' })).not.toContain('>Proposals<');
  });
  it('explains an older server and other failures', () => {
    expect(proposalsLoadError(new ApiRequestError(400, 'x'))).toContain('aren’t available on the server yet');
    expect(proposalsLoadError(new Error('boom'))).toContain('could not be loaded');
  });
});

describe('Polish', () => {
  it('does not repeat a company that is the client name', () => {
    const same: PmClientSummary = { ...ben, displayName: 'Resort Co', company: 'resort co', projects: [{ projectId: 'p', name: 'Site', previewPublished: false }] };
    const html = render({ clients: [same] });
    expect(html).toContain('>Site<');
    expect(html).not.toContain('resort co');
  });
  it('shows Refresh only when the page owns refreshing', () => {
    expect(render()).toContain('Refresh clients');
    expect(render({ onRefresh: undefined })).not.toContain('Refresh clients');
  });
});
