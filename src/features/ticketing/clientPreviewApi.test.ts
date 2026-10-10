import { describe, expect, it, vi } from 'vitest';
import { clientPreviewApi } from './clientPreviewApi';

const workspace = 'client-ui-sample-workspace';

describe('real client UI sample transport', () => {
  it('projects only authorized fictional client tickets, not PM notes or intake contacts', async () => {
    const page = await clientPreviewApi.listTickets(workspace);
    expect(page.items).toHaveLength(4);
    expect(page.counters).toEqual({ kind: 'client', open: 3, needsClient: 2 });
    for (const item of page.items) {
      const ticket = await clientPreviewApi.getTicket(workspace, item.id);
      expect(ticket).not.toHaveProperty('internal');
      expect(ticket).not.toHaveProperty('notes');
      expect(ticket).not.toHaveProperty('contact');
      expect(ticket).toMatchObject({ readOnly: true, writesAvailable: false });
    }
    await expect(clientPreviewApi.getTicket(workspace, 'preview-ticket-1045')).rejects.toMatchObject({ status: 404 });
    await expect(clientPreviewApi.getMessages(workspace, 'preview-ticket-1045')).rejects.toMatchObject({ status: 404 });
  });

  it('supports the real client search, action filter and history controls', async () => {
    expect((await clientPreviewApi.listTickets(workspace, { filter: 'needs_client' })).items).toHaveLength(2);
    expect((await clientPreviewApi.listTickets(workspace, { filter: 'history' })).items.map(item => item.reference)).toEqual(['DEMO-1041']);
    expect((await clientPreviewApi.listTickets(workspace, { search: 'CSV' })).items.map(item => item.reference)).toEqual(['DEMO-1042']);
    expect((await clientPreviewApi.listTickets(workspace, { search: 'no-such-ticket' })).items).toHaveLength(0);
    await expect(clientPreviewApi.listTickets('another-workspace')).rejects.toMatchObject({ status: 404 });
  });

  it('never falls back to a real network request, identity provider or write', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No network allowed'));
    try {
      await clientPreviewApi.getSession();
      await clientPreviewApi.listWorkspaces();
      await clientPreviewApi.getIntakeContext(workspace);
      await expect(clientPreviewApi.signOut()).rejects.toMatchObject({ status: 503 });
      await expect(clientPreviewApi.createSessionFromEmailLink('not-a-token-hash', 'magiclink')).rejects.toMatchObject({ status: 503 });
      await expect(clientPreviewApi.createTicket({ schemaVersion: 1, intakeContextId: 'sample-context', operationId: 'sample-operation', title: 'Sample only', description: 'Never sent' })).rejects.toMatchObject({ status: 503 });
      await expect(clientPreviewApi.getDelivery(workspace, 'preview-ticket-1044', 'missing-delivery')).rejects.toMatchObject({ status: 503 });
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
});
