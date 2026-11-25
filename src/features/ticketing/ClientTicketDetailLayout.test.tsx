import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientRequestRail, ClientTicketDetail } from './ClientTicketDetail';

describe('client ticket detail layout', () => {
  it('shows task-based status in a project request without a plan', () => {
    const html = renderToStaticMarkup(<ClientRequestRail
      workspaceId="workspace-a" projectPanel checklist="ready_to_check"
      ticket={{ id: 'ticket-a', reference: 'TKT-1', title: 'Example request', status: 'under_review',
        createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
        readOnly: false, writesAvailable: true, requestedAction: null, description: 'Request details',
        companyLabel: 'Calc Co.', version: 2, sharedProjectName: 'Website', relatedTicket: null,
        scope: null, delivery: null, request: null }}
      busy={false} onReply={async () => undefined} onDecision={() => undefined}
      onAdditionalWork={() => undefined} onCorrection={async () => undefined}
    />);
    expect(html).toContain('Ready to check');
    expect(html).not.toContain('Planning');
    expect(html).not.toContain('Approve plan');
    expect(html).not.toContain('What happens next');
  });

  it('fills the left side with the conversation and keeps the request details in the panel on the right', () => {
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
    expect(html).toContain('Message the project manager…');
    expect(html).not.toContain('ticket-chat__header');
    expect(html).toContain('class="client-reply-form"');
    expect(html).toContain('aria-label="Send reply"');
    expect(html).toContain('min-h-[44px]');
    expect(html).not.toContain('Orchestrator');

    const chat = html.indexOf('cx-reqchat');
    const rail = html.indexOf('aria-label="About this request"');
    expect(chat).toBeGreaterThan(-1);
    expect(rail).toBeGreaterThan(chat);
    const conversation = html.slice(chat, rail);
    const side = html.slice(rail);
    // The panel leads with the request, the decision owed on it, a plain sentence on where it stands, and the steps.
    expect(side).toContain('id="client-request-title"');
    expect(side).toContain('Work starts once it is approved.');
    expect(side.indexOf('client-decision-slot')).toBeGreaterThan(side.indexOf('id="client-request-title"'));
    expect(side.indexOf('client-decision-slot')).toBeLessThan(side.indexOf('aria-label="Request progress"'));
    expect(side).toContain('Update the report filters.');
    expect(side).toContain('Approve the plan · you');
    expect(side).toContain('What happens next');
    expect(side).toContain('Once you approve, the project manager starts the work.');
    // The plan is shown once, as the decision, and not repeated as its own section.
    expect(side.match(/Update the report filters\./g)).toHaveLength(1);
    expect(conversation).not.toContain('client-decision-slot');
    // Milestones sit in the conversation as updates, in date order with the messages.
    expect(conversation).toContain('Hello there');
    expect(conversation).toContain('Update at');
    expect(conversation).toContain('Plan sent for your approval');
    // The panel also holds what was asked, files and the reference with its copy button; files and details fold away.
    expect(side).toContain('What you asked for');
    expect(side).toMatch(/aria-expanded="true"[^>]*>.*?Files/);
    expect(side).toMatch(/aria-expanded="true"[^>]*>.*?Request details/);
    expect(side).toContain('TKT-1');
    expect(side).toContain('Copy request reference');
    expect(side).toContain('The project manager');
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
