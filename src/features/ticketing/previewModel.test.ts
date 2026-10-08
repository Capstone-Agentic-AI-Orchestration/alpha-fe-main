import { beforeEach, describe, expect, it } from 'vitest';
import { createTicketPreview, matchesTicketFilter, PREVIEW_STAGES, ticketCounters } from './previewModel';
import type { PreviewStage, TicketPreview } from './previewModel';

let preview: TicketPreview;
let timestamp: string;
let sequence: number;
const request = { title: 'User-entered title', description: 'User-entered request description' };
beforeEach(() => {
  sequence = 0; timestamp = '2026-10-08T00:00:00.000Z';
  preview = createTicketPreview(() => timestamp, () => `test-${++sequence}`);
});
describe('temporary ticket UI rehearsal, not production workflow', () => {
  it('starts empty without invented people, projects, counts or messages', () => {
    expect(preview.listClient()).toEqual([]);
    expect(preview.listPm()).toEqual([]);
    expect(ticketCounters([], timestamp, 'Asia/Manila')).toEqual({
      open: 0, needs_client: 0, needs_pm: 0, in_progress: 0, waiting_client: 0, closed_month: 0,
    });
  });
  it('creates only what the user entered, with a local reference and no implied project', () => {
    const ticket = preview.create({ title: '  Title  ', description: '  Description  ' });
    expect(ticket).toMatchObject({ reference: 'LOCAL-1', title: 'Title', description: 'Description', status: 'Received', actionOwner: 'pm' });
    expect(ticket).not.toHaveProperty('projectId');
    expect(ticket).not.toHaveProperty('workspaceId');
    expect(ticket).not.toHaveProperty('scopeApproved');
  });
  it.each([{ ...request, title: '' }, { ...request, description: ' ' }, { ...request, title: 'x'.repeat(161) }, { ...request, description: 'x'.repeat(6001) }])('rejects invalid request text without creating a record', input => {
    expect(() => preview.create(input)).toThrow();
    expect(preview.listClient()).toHaveLength(0);
  });
  it('keeps one shared public conversation without changing the ongoing-work scene', () => {
    const ticket = preview.create(request);
    preview.setScene(ticket.id, 'implementing');
    timestamp = '2026-10-08T01:00:00.000Z';
    preview.message(ticket.id, 'pm', 'Public response');
    preview.message(ticket.id, 'client', 'Client reply');
    expect(preview.listClient()[0].messages.map(message => message.body)).toEqual(['Public response', 'Client reply']);
    expect(preview.listClient()[0].status).toBe('In progress');
    expect(preview.listPm()[0].messages).toEqual(preview.listClient()[0].messages);
  });
  it('excludes private notes and internal update timestamps from the client projection', () => {
    const ticket = preview.create(request);
    timestamp = '2026-10-08T02:00:00.000Z';
    preview.message(ticket.id, 'pm', 'Internal-only context', true);
    const client = preview.listClient()[0];
    expect(JSON.stringify(client)).not.toContain('Internal-only context');
    expect(client).not.toHaveProperty('notes');
    expect(client).not.toHaveProperty('internalUpdatedAt');
    expect(client.updatedAt).toBe(ticket.updatedAt);
    expect(preview.listPm()[0].internalUpdatedAt).toBe(timestamp);
    expect(preview.listPm()[0].notes).toHaveLength(1);
  });
  it('rejects private notes from the client preview', () => {
    const ticket = preview.create(request);
    expect(() => preview.message(ticket.id, 'client', 'No', true)).toThrow(/Only the PM/);
    expect(preview.listPm()[0].notes).toHaveLength(0);
  });
  it.each(['closed', 'declined', 'cancelled'] as PreviewStage[])('makes the %s scene read-only for both views', stage => {
    const ticket = preview.create(request);
    preview.setScene(ticket.id, stage);
    expect(() => preview.message(ticket.id, 'client', 'Late reply')).toThrow(/read-only/);
    expect(() => preview.message(ticket.id, 'pm', 'Late note', true)).toThrow(/read-only/);
  });
  it('creates extra work as a separate linked request without reopening the original', () => {
    const original = preview.create(request);
    preview.setScene(original.id, 'closed');
    const extra = preview.create({ ...request, title: 'Additional work', relatedTicketId: original.id });
    expect(extra.relatedTicketId).toBe(original.id);
    expect(extra.status).toBe('Received');
    expect(preview.listClient().find(ticket => ticket.id === original.id)?.status).toBe('Closed');
  });
  it('does not accept missing ticket references or unknown preview scenes', () => {
    expect(() => preview.create({ ...request, relatedTicketId: 'missing' })).toThrow(/not available/);
    expect(() => preview.message('missing', 'pm', 'No')).toThrow(/not available/);
    const ticket = preview.create(request);
    expect(() => preview.setScene(ticket.id, 'not-a-scene' as PreviewStage)).toThrow(/Unknown/);
  });
  it('returns defensive copies and clears only its own temporary records', () => {
    const ticket = preview.create(request);
    preview.message(ticket.id, 'pm', 'Saved');
    const snapshot = preview.listClient();
    snapshot[0].messages[0].body = 'Changed externally';
    snapshot[0].title = 'Changed';
    expect(preview.listClient()[0].title).toBe(request.title);
    expect(preview.listClient()[0].messages[0].body).toBe('Saved');
    preview.clear();
    expect(preview.listClient()).toEqual([]);
    expect(preview.listPm()).toEqual([]);
  });
  it('rejects invalid clocks without creating tickets', () => {
    expect(() => createTicketPreview(() => 'invalid').create(request)).toThrow(/clock/);
  });
  it('counts client action as a subset of open tickets, and does not call holds client waiting', () => {
    const waiting = preview.create(request);
    preview.setScene(waiting.id, 'client_review');
    const held = preview.create(request);
    preview.setScene(held.id, 'held');
    const counts = ticketCounters(preview.listClient(), timestamp, 'Asia/Manila');
    expect(counts).toMatchObject({ open: 2, needs_client: 1, waiting_client: 1 });
    expect(matchesTicketFilter(preview.listClient()[0], 'waiting_client', timestamp, 'Asia/Manila')).toBe(false);
  });
  it('allows operational counters to overlap without treating them as a total', () => {
    const ticket = preview.create(request);
    preview.setScene(ticket.id, 'pm_review');
    expect(ticketCounters(preview.listClient(), timestamp, 'Asia/Manila')).toMatchObject({ needs_pm: 1, in_progress: 1 });
  });
  it('uses the provided timezone for month boundaries and excludes declines from closure', () => {
    const closed = preview.create(request);
    timestamp = '2026-09-30T16:30:00.000Z'; // October in Manila, September in UTC.
    preview.setScene(closed.id, 'closed');
    const declined = preview.create(request);
    preview.setScene(declined.id, 'declined');
    timestamp = '2026-10-15T00:00:00.000Z';
    expect(ticketCounters(preview.listClient(), timestamp, 'Asia/Manila').closed_month).toBe(1);
    expect(ticketCounters(preview.listClient(), timestamp, 'UTC').closed_month).toBe(0);
  });
  it('supplies every fixture scene without claiming an acceptance or project completion', () => {
    const ticket = preview.create(request);
    for (const stage of Object.keys(PREVIEW_STAGES) as PreviewStage[]) {
      preview.setScene(ticket.id, stage);
      expect(preview.listClient()[0]).not.toHaveProperty('acceptance');
      expect(preview.listClient()[0]).not.toHaveProperty('projectCompleted');
    }
  });
});
