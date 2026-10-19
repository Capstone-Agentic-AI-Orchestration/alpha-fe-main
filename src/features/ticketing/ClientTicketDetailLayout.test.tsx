import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientTicketDetail } from './ClientTicketDetail';

describe('client ticket detail layout', () => {
  it('opens on the conversation with tabs, a pinned reply box and an action-needed banner', () => {
    const html = renderToStaticMarkup(<ClientTicketDetail
      workspaceId="workspace-a"
      communicationEnabled
      ticket={{ id: 'ticket-a', reference: 'TKT-1', title: 'Example request', status: 'awaiting_client',
        createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
        readOnly: false, writesAvailable: true, requestedAction: 'agree_scope', description: 'Request details',
        companyLabel: 'Calc Co.', version: 2, sharedProjectName: null, relatedTicket: null,
        scope: { id: 'scope-a', summary: 'Update the report filters.', proposedAt: '2026-10-17T00:00:00Z', agreed: false },
        delivery: null, request: null }}
      messages={[{ id: 'm1', author: 'pm', body: 'Hello there', createdAt: '2026-10-17T09:00:00Z' },
        { id: 'm2', author: 'client', body: 'Thanks', createdAt: '2026-10-17T09:05:00Z' }]}
      messageCursor={null} historyLoading={false} historyError="" busy={false} error=""
      replyResetVersion={0} onBack={() => undefined} onLoadMore={() => undefined}
      onReply={async () => undefined} onDecision={() => undefined} onAdditionalWork={() => undefined}
      onCorrection={async () => undefined}
    />);
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="client-tab-conversation"[^>]*aria-selected="true"/);
    expect(html).toMatch(/id="client-tab-details"[^>]*aria-selected="false"/);
    expect(html).toContain('Action needed: ');
    expect(html).toContain('Review scope');
    expect(html).toContain('Write a message…');
    expect(html).toContain('Hello there');
    expect(html).toContain('Copy ticket reference');
    // The progress path sits in the banner: Agree scope is the current step, and it is the client's turn.
    expect(html).toContain('aria-label="Request progress"');
    expect(html).toContain('Agree scope · you');
  });
});
