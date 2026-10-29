import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClientTicketDetail } from './ClientTicketDetail';

describe('client ticket detail layout', () => {
  it.each(['conversation', 'details'] as const)('keeps conversation visible with the %s sidebar section selected', defaultTab => {
    const html = renderToStaticMarkup(<ClientTicketDetail
      workspaceId="workspace-a"
      communicationEnabled
      defaultTab={defaultTab}
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
    expect(html).toMatch(new RegExp(`id="client-tab-conversation"[^>]*aria-selected="${defaultTab === 'conversation'}"`));
    expect(html).toMatch(new RegExp(`id="client-tab-details"[^>]*aria-selected="${defaultTab === 'details'}"`));
    expect(html).toContain('Action needed: ');
    expect(html).toContain('Decision needed');
    expect(html).toContain('Review proposed work');
    expect(html).toContain('Write a message…');
    expect(html).toContain('aria-label="Conversation"');
    expect(html).not.toContain('client-conversation-heading');
    expect(html.match(/Only you and your project manager can see this\./g)).toHaveLength(1);
    expect(html).toContain('class="client-reply-form"');
    expect(html).toContain('aria-label="Send reply"');
    expect(html).toContain('Hello there');
    expect(html).toContain('Copy request reference');
    expect(html).toContain('Show progress');
    expect(html).toContain('aria-label="Project overview"');
    expect(html).toContain('role-chat-layout');
    const sidebar = html.slice(html.indexOf('aria-label="Project overview"'));
    expect(sidebar).toContain('client-sidebar-progress');
    expect(sidebar).toContain('aria-label="Request progress"');
    expect(sidebar).toContain('id="client-panel-details"');
    expect(html.slice(0, html.indexOf('aria-label="Project overview"'))).toContain('Hello there');
    expect(html.slice(0, html.indexOf('aria-label="Project overview"'))).not.toContain('id="client-panel-details"');
    expect(html.slice(0, html.indexOf('role-chat-layout'))).not.toContain('client-detail-status-head');
    expect(html).not.toContain('Orchestrator');
    expect(html).toContain('aria-controls="client-request-progress"');
    expect(html).toContain('min-h-[44px]');
    // The progress path names the proposed work as the current step and makes the client's turn explicit.
    expect(html).toContain('aria-label="Request progress"');
    expect(html).toContain('Review proposed work · you');
  });
});
