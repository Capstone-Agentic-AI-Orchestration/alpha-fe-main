import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientTicketDetail } from './ClientTicketDetail';

describe('client ticket detail layout', () => {
  it('puts the decision and the conversation first, with request details in a side column', () => {
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
    // No tabs: everything about the request is on one page.
    expect(html).not.toContain('role="tablist"');
    expect(html).toContain('Action needed: Approve the plan');
    expect(html).toContain('Approve plan');
    expect(html).toContain('Message your project manager…');
    expect(html).not.toContain('ticket-chat__header');
    expect(html).toContain('class="client-reply-form"');
    expect(html).toContain('aria-label="Send reply"');
    expect(html).toContain('min-h-[44px]');
    expect(html).not.toContain('Orchestrator');

    const rail = html.indexOf('aria-label="About this request"');
    expect(rail).toBeGreaterThan(-1);
    const header = html.slice(0, html.indexOf('cx-request-layout'));
    const main = html.slice(html.indexOf('cx-request-layout'), rail);
    const side = html.slice(rail);
    // The header leads with a plain sentence and the step path; the ticket code is not there.
    expect(header).toContain('Work starts once it is approved.');
    expect(header).toContain('aria-label="Request progress"');
    expect(header).toContain('Approve the plan · you');
    expect(header).not.toContain('TKT-1');
    // The decision sits above the conversation in the main column.
    expect(main.indexOf('client-decision-slot')).toBeGreaterThan(-1);
    expect(main.indexOf('client-decision-slot')).toBeLessThan(main.indexOf('Hello there'));
    // The plan is shown once, as the decision, not repeated in the side column.
    expect(side).not.toContain('Update the report filters.');
    // The side column holds what was asked, files and the reference with its copy button.
    expect(side).toContain('What you asked for');
    expect(side).toContain('Request details');
    expect(side).toContain('TKT-1');
    expect(side).toContain('Copy request reference');
  });

  it('keeps an agreed plan in the side column once nothing is asked of the client', () => {
    const html = renderToStaticMarkup(<ClientTicketDetail
      workspaceId="workspace-a"
      ticket={{ id: 'ticket-a', reference: 'TKT-1', title: 'Example request', status: 'in_progress',
        createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
        readOnly: false, writesAvailable: true, requestedAction: null, description: 'Request details',
        companyLabel: 'Calc Co.', version: 2, sharedProjectName: 'Website', relatedTicket: null,
        scope: { id: 'scope-a', summary: 'Update the report filters.', proposedAt: '2026-10-17T00:00:00Z', agreed: true },
        delivery: null, request: null }}
      messages={[]} messageCursor={null} historyLoading={false} historyError="" busy={false} error=""
      replyResetVersion={0} onBack={() => undefined} onLoadMore={() => undefined}
      onReply={async () => undefined} onDecision={() => undefined} onAdditionalWork={() => undefined}
      onCorrection={async () => undefined}
    />);
    expect(html).not.toContain('client-decision-slot');
    const side = html.slice(html.indexOf('aria-label="About this request"'));
    expect(side).toContain('The plan');
    expect(side).toContain('You approved this plan.');
    expect(side).toContain('Website');
  });
});
