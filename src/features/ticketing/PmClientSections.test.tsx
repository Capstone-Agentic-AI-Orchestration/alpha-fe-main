import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.hoisted(() => { (globalThis as { window?: unknown }).window ??= globalThis; });

import { ClientConversations, ClientOverview, ClientProjects, ClientProposals, previewState, loadClientProjects, loadClientRequests } from './PmClientSections';
import type { PmClientConversation, PmClientSummary, PmTicketQueueItem, PmTicketQueuePage } from './pmApi';

const client: PmClientSummary = {
  key: 'client:ana', displayName: 'Ana Cruz', company: 'Resort Co', access: 'active',
  tickets: { needsPm: 1, waitingClient: 1, open: 2, closed: 1, unlinkedOpen: 0, accessRevoked: 0 },
  projects: [], lastActivityAt: '2026-11-15T10:00:00.000Z',
};
const request = (id: string, title: string, status: PmTicketQueueItem['status'], actionOwner: 'pm' | 'client' | null, updatedAt: string) => ({
  id, reference: id, title, status, createdAt: updatedAt, updatedAt, closedAt: null, readOnly: false, writesAvailable: true, requestedAction: null,
  internal: { updatedAt, actionOwner, nextAction: null, projectId: null, projectName: null,
    clientGroup: { key: client.key, displayName: client.displayName }, clientAccessActive: true, clientInvitation: null },
}) as unknown as PmTicketQueueItem;
const requests = [
  request('t1', 'Booking widget', 'in_progress', 'client', '2026-11-10T10:00:00.000Z'),
  request('t2', 'Fix checkout', 'under_review', 'pm', '2026-11-12T10:00:00.000Z'),
  request('t3', 'Old logo', 'closed', null, '2026-10-01T10:00:00.000Z'),
];
const conversations: PmClientConversation[] = [
  { ticketId: 't1', latestMessage: { id: 'm1', author: 'client', preview: 'Can we add dates?', truncated: true, createdAt: '2026-11-14T10:00:00.000Z' } },
  { ticketId: 't2', latestMessage: null },
];

describe('Client overview', () => {
  it('uses the server counts and lists open requests with the one needing the PM first', () => {
    const html = renderToStaticMarkup(<ClientOverview client={client} requests={requests} conversations={conversations} onOpenRequest={() => undefined} />);
    for (const shown of ['Need you', 'Waiting on client', 'Open requests', '1 needs you', 'Ana Cruz wrote on Booking widget']) expect(html).toContain(shown);
    expect(html.indexOf('Fix checkout')).toBeLessThan(html.indexOf('Booking widget'));
    expect(html.split('Recent activity')[0]).not.toContain('Old logo');
  });
});

describe('Client conversations', () => {
  it('shows one row per request with the latest message, newest first', () => {
    const html = renderToStaticMarkup(<ClientConversations client={client} requests={requests} conversations={conversations} error="" onOpenRequest={() => undefined} />);
    expect(html).toContain('Ana Cruz: Can we add dates?…');
    expect(html).toContain('No messages yet');
    expect(html.indexOf('Booking widget')).toBeLessThan(html.indexOf('Fix checkout'));
  });
  it('shows the error instead of rows', () => {
    const html = renderToStaticMarkup(<ClientConversations client={client} requests={requests} conversations={null} error="Conversations could not be loaded." onOpenRequest={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('Booking widget');
  });
});

describe('Loading a client’s requests', () => {
  it('reads every page for this client only', async () => {
    const pages: Record<string, PmTicketQueuePage> = {
      start: { items: requests.slice(0, 2), nextCursor: 'next', counters: null } as unknown as PmTicketQueuePage,
      next: { items: requests.slice(2), nextCursor: null, counters: null } as unknown as PmTicketQueuePage,
    };
    const list = vi.fn(async (options: { after?: string | null; clientGroupKey?: string }) => pages[options.after ?? 'start']);
    const result = await loadClientRequests(list as never, 'client:ana');
    expect(result.items.map(item => item.id)).toEqual(['t1', 't2', 't3']);
    for (const [options] of list.mock.calls) expect(options.clientGroupKey).toBe('client:ana');
  });
});

describe('Client projects', () => {
  const withProjects: PmClientSummary = { ...client, projects: [
    { projectId: 'p1', name: 'Resort Website', previewPublished: true },
    { projectId: 'p2', name: 'Booking System', previewPublished: false },
  ] };
  const api = {
    getProjectClientPreview: vi.fn(async (projectId: string) => ({ preview: projectId === 'p1' ? { repository: 'r', branch: 'uat' as const, url: 'https://preview.example.test' } : null })),
    listProjectPreviewClients: vi.fn(async () => ({ items: [{ clientId: 'ana', displayName: 'Ana Cruz' }, { clientId: 'ben', displayName: 'Ben' }] })),
    getProjectFeedbackMessages: vi.fn(async (projectId: string, clientId: string) => {
      if (projectId === 'p2') throw new Error('boom');
      return { items: [
        { id: 'f1', clientId, author: 'client' as const, body: 'Older', createdAt: '2026-11-01T10:00:00.000Z' },
        { id: 'f2', clientId, author: 'pm' as const, body: 'Newer', createdAt: '2026-11-02T10:00:00.000Z' },
      ], nextCursor: null };
    }),
  };

  it('loads each project for this client only, newest feedback first, and isolates a failing project', async () => {
    const details = await loadClientProjects(api as never, withProjects);
    expect(api.getProjectFeedbackMessages).toHaveBeenCalledWith('p1', 'ana', { limit: 3 });
    expect(details[0]).toMatchObject({ previewUrl: 'https://preview.example.test', feedback: [{ id: 'f2' }, { id: 'f1' }] });
    expect(details[1]).toMatchObject({ projectId: 'p2', previewUrl: null, feedback: null });
  });

  it('shows the preview link, feedback, and links only to known projects', async () => {
    const details = await loadClientProjects(api as never, withProjects);
    const html = renderToStaticMarkup(<ClientProjects client={withProjects} projects={details} knownProjectIds={new Set(['p1'])} onOpenProject={() => undefined} />);
    const [firstCard, secondCard] = html.split('</section>');
    expect(firstCard).toContain('href="https://preview.example.test"');
    expect(firstCard).toContain('Ana Cruz');
    expect(firstCard).toContain('Newer');
    expect(firstCard).toContain('Open conversation');
    expect(secondCard).toContain('Project feedback could not be loaded.');
    expect(secondCard).not.toContain('Open preview');
    expect(secondCard).not.toContain('Open conversation');
  });

  it('never links a preview address that is not a web page', () => {
    const html = renderToStaticMarkup(<ClientProjects client={withProjects} knownProjectIds={new Set()} onOpenProject={() => undefined}
      projects={[{ projectId: 'p1', name: 'Resort Website', previewPublished: true, previewUrl: 'javascript:alert(1)', feedback: [] }]} />);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('No project feedback from this client yet.');
  });
});

describe('Client proposals', () => {
  const item = { kind: 'project_proposal' as const, status: 'awaiting_client' as const, id: 'p1', fullName: 'Ana', email: 'ana@example.test',
    company: null, title: 'Booking app', description: 'Let guests book online', requestedDeadline: null, submittedAt: '2026-11-03T00:00:00.000Z' };
  it('lists proposals with their status and points to Inquiries for decisions', () => {
    const html = renderToStaticMarkup(<ClientProposals proposals={[item]} error="" onOpenInquiries={() => undefined} />);
    for (const shown of ['Booking app', 'Let guests book online', 'Waiting on the client', '1 still open', 'Inquiries']) expect(html).toContain(shown);
  });
  it('lets each proposal open that exact inquiry, on the tab that lists it', () => {
    const html = renderToStaticMarkup(<ClientProposals proposals={[item]} error="" onOpenInquiries={() => undefined} />);
    expect(html).toMatch(/<button[^>]*title="Open Booking app in Inquiries"[^>]*>Booking app<\/button>/);
  });
  it('shows an empty state and errors', () => {
    expect(renderToStaticMarkup(<ClientProposals proposals={[]} error="" onOpenInquiries={() => undefined} />)).toContain('hasn’t sent any project proposals');
    expect(renderToStaticMarkup(<ClientProposals proposals={null} error="Nope" onOpenInquiries={() => undefined} />)).toContain('role="alert"');
  });
});

describe('Preview state', () => {
  it('reads consistently with the preview link', () => {
    expect(previewState(true, true)).toBe('Shared with the client for review');
    expect(previewState(false, true)).toBe('Preview link ready · not shared with the client yet');
    expect(previewState(false, false)).toBe('No preview yet');
  });
});
