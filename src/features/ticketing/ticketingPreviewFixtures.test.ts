import { describe, expect, it } from 'vitest';
import { createClientPreviewModel, DEMO_TICKETS, pmPreviewApi } from './ticketingPreviewFixtures';

describe('ticketing UI preview fixtures', () => {
  it('provides several fictional ticket states to the real PM Tickets view', async () => {
    const queue = await pmPreviewApi.list({ filter: 'all' });

    expect(queue.items).toHaveLength(DEMO_TICKETS.length);
    expect(queue.counters).toMatchObject({ kind: 'pm', needsPm: 1, inProgress: 1, waitingClient: 2 });
    expect(queue.items.map(ticket => ticket.reference)).toContain('DEMO-1042');
    expect(queue.items.every(ticket => ticket.readOnly && !ticket.writesAvailable)).toBe(true);
  });

  it('shows messages and PM-only notes for a selected fictional ticket', async () => {
    const ticket = await pmPreviewApi.get('preview-ticket-1042');
    const messages = await pmPreviewApi.getMessages(ticket.id);
    const notes = await pmPreviewApi.getNotes(ticket.id);

    expect(messages.items.some(item => item.author === 'client')).toBe(true);
    expect(notes.items.some(item => item.body.includes('Preview example'))).toBe(true);
  });

  it('keeps unverified inquiries out of the client ticket list', () => {
    const model = createClientPreviewModel();

    expect(model.listClient()).toHaveLength(4);
    expect(model.listClient().every(ticket => !ticket.title.includes('inventory overview'))).toBe(true);
  });

  it('blocks writes in the PM preview', async () => {
    await expect(pmPreviewApi.execute('preview-ticket-1042', {
      schemaVersion: 1,
      operationId: 'preview-operation',
      expectedVersion: 1,
      command: { type: 'review' },
    })).rejects.toThrow('Ticket changes are disabled in the local UI preview.');
  });
});
