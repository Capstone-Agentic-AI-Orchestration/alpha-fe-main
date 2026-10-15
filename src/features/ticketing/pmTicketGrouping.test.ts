import { describe, expect, it } from 'vitest';
import type { PmTicketQueueItem } from './pmApi';
import { groupPmTickets } from './pmTicketGrouping';

function item(id: string, input: {
  clientKey?: string; clientName?: string; projectId?: string | null; projectName?: string | null;
} = {}): PmTicketQueueItem {
  return {
    id, reference: id, title: id, status: 'received', createdAt: '2026-10-14T00:00:00Z',
    updatedAt: '2026-10-14T00:00:00Z', closedAt: null, readOnly: false, writesAvailable: true,
    requestedAction: null,
    internal: {
      updatedAt: '2026-10-14T00:00:00Z', actionOwner: 'pm', nextAction: 'review_ticket',
      projectId: input.projectId ?? null, projectName: input.projectName ?? null,
      clientAccessActive: true, clientInvitation: null,
      ...(input.clientKey ? { clientGroup: {
        key: input.clientKey, displayName: input.clientName ?? 'Verified client',
        acceptsNewRequests: true, accessActive: true,
      } } : {}),
    },
  };
}

describe('PM client and project queue groups', () => {
  it('groups one verified client’s requests under their distinct projects', () => {
    const groups = groupPmTickets([
      item('request-1', { clientKey: 'client:a', clientName: 'A Client', projectId: 'project:a', projectName: 'Alpha' }),
      item('request-2', { clientKey: 'client:a', clientName: 'A Client', projectId: 'project:a', projectName: 'Alpha' }),
      item('request-3', { clientKey: 'client:a', clientName: 'A Client', projectId: 'project:b', projectName: 'Beta' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: 'A Client', tickets: 3 });
    expect(groups[0]?.projects.map(project => [project.name, project.tickets.length]))
      .toEqual([['Alpha', 2], ['Beta', 1]]);
  });

  it('never combines unverified inquiries or unrelated clients by matching labels', () => {
    const groups = groupPmTickets([
      item('unverified-1', { projectId: null }),
      item('unverified-2', { projectId: null }),
      item('client-1', { clientKey: 'client:1', clientName: 'Northstar' }),
      item('client-2', { clientKey: 'client:2', clientName: 'Northstar' }),
    ]);

    expect(groups).toHaveLength(4);
    expect(groups.map(group => group.tickets)).toEqual([1, 1, 1, 1]);
  });
  it('collects unlinked requests in one separate project bucket for the same verified client', () => {
    const groups = groupPmTickets([
      item('unlinked-1', { clientKey: 'client:a', clientName: 'A Client' }),
      item('unlinked-2', { clientKey: 'client:a', clientName: 'A Client' }),
    ]);
    expect(groups[0]?.projects).toHaveLength(1);
    expect(groups[0]?.projects[0]).toMatchObject({ name: null, projectId: null, tickets: [{ id: 'unlinked-1' }, { id: 'unlinked-2' }] });
  });
});
