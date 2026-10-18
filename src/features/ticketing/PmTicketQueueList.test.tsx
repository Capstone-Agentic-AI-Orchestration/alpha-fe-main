import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PmTicketQueueItem } from './pmApi';
import { PmTicketQueueList } from './PmTicketQueueList';

const item: PmTicketQueueItem = {
  id: 'ticket-1', reference: 'TKT-1', title: 'Review the client request', status: 'under_review',
  createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', closedAt: null,
  readOnly: false, writesAvailable: true, requestedAction: null,
  internal: {
    updatedAt: '2026-10-17T00:00:00Z', actionOwner: 'pm', nextAction: 'review_ticket',
    projectId: null, projectName: null, clientAccessActive: true, clientInvitation: null,
  },
};

describe('PM ticket queue list', () => {
  it('shows the precise next step and exposes selected tickets to assistive technology', () => {
    const html = renderToStaticMarkup(<PmTicketQueueList
      items={[item]} selectedId="ticket-1" disabled={false} requestAccessSaving={null}
      onSelect={() => undefined} onToggleRequests={() => undefined}
    />);
    expect(html).toContain('PM action · Review request');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('focus-visible:outline');
  });
});
