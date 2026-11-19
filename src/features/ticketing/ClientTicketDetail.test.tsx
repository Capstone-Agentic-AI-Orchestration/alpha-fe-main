import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientTicketDetail } from './ClientTicketDetail';

describe('client ticket detail', () => {
  it('gives a client a plain-language current status and next step', () => {
    const html = renderToStaticMarkup(<ClientTicketDetail
      workspaceId="workspace-a"
      ticket={{ id: 'ticket-a', reference: 'TKT-1', title: 'Example request', status: 'awaiting_client',
        createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
        readOnly: false, writesAvailable: true, requestedAction: 'agree_scope', description: 'Request details',
        companyLabel: 'Example Co.', version: 2, sharedProjectName: null, relatedTicket: null,
        scope: { id: 'scope-a', summary: 'Update the report filters.', proposedAt: '2026-10-17T00:00:00Z', agreed: false },
        delivery: null, request: null }}
      messages={[]} messageCursor={null} historyLoading={false} historyError="" busy={false} error=""
      replyResetVersion={0} onBack={() => undefined} onLoadMore={() => undefined}
      onReply={async () => undefined} onDecision={() => undefined} onAdditionalWork={() => undefined}
      onCorrection={async () => undefined}
    />);
    expect(html).toContain('Approve the plan');
    expect(html).toContain('Work starts once it is approved.');
    // The decision sits above the conversation, not behind a side tab.
    expect(html.indexOf('Approve plan')).toBeGreaterThan(-1);
    expect(html.indexOf('client-decision-slot')).toBeLessThan(html.indexOf('Message your project manager…'));
    expect(html).toContain('Ask for changes');
  });

  it.each([false, true])('explains the current stage with disabled workflow actions (read-only preview: %s)', readOnlyPreview => {
    const html = renderToStaticMarkup(<ClientTicketDetail
      workspaceId="workspace-a"
      workflowActionsDisabled
      readOnlyPreview={readOnlyPreview}
      ticket={{ id: 'ticket-a', reference: 'TKT-1', title: 'Example request', status: 'in_progress',
        createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
        readOnly: false, writesAvailable: true, requestedAction: null, description: 'Request details',
        companyLabel: 'Example Co.', version: 2, sharedProjectName: null, relatedTicket: null,
        scope: null, delivery: null, request: null }}
      messages={[{ id: 'sample-message', author: 'pm', body: 'Fictional project update', createdAt: '2026-10-17T01:00:00Z' }]} messageCursor={null} historyLoading={false} historyError="" busy={false} error=""
      replyResetVersion={0} onBack={() => undefined} onLoadMore={() => undefined}
      onReply={async () => undefined} onDecision={() => undefined} onAdditionalWork={() => undefined}
      onCorrection={async () => undefined}
    />);
    expect(html).toContain('The work is underway');
    expect(html).toContain('You do not need to do anything right now');
    expect(html).toContain('In progress (current step)');
    expect(html).not.toContain('Action needed:');
    expect(html).not.toContain('Approve plan');
    if (readOnlyPreview) {
      expect(html).toContain('Fictional project update');
      expect(html).not.toContain('aria-label="Send reply"');
      expect(html).not.toContain('id="client-ticket-reply"');
    }
  });
});
