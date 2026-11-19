import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';

/** Tab state another page sets to open one inquiry here (a client's Proposals tab). */
export const OPEN_INQUIRY_KEY = 'inquiries.open';
/** Tab state this page sets so Tickets opens the request an inquiry just became. */
export const OPEN_TICKET_KEY = 'tickets.open';

export type OpenInquiry = { id: string; view: 'pending' | 'handled' };

/** Shared inquiry intake as a distinct PM sidebar destination. */
export function PmInquiriesPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeWorkspace, setActiveTab, showToast } = useApp();
  const [openInquiry, setOpenInquiry] = useTabSessionState<OpenInquiry | null>(OPEN_INQUIRY_KEY, null);
  const [, setOpenTicket] = useTabSessionState<string | null>(OPEN_TICKET_KEY, null);
  // Read once on arrival: the inbox keeps it as its starting selection, and coming back later starts fresh.
  const [initialSelection] = useState(openInquiry);
  useEffect(() => { if (openInquiry) setOpenInquiry(null); }, [openInquiry, setOpenInquiry]);

  return <div className="pm-ticket-page pm-ticket-page--nested">
    <nav aria-label="Inquiries actions" className="pm-ticket-page__tabs">
      <div className="pm-ticket-page__tab-actions">
        <Button variant="ghost" size="sm" onClick={() => setRefreshToken(value => value + 1)}
          aria-label="Refresh inquiries" title="Refresh inquiries">
          <RefreshCw size={14} aria-hidden="true" /><span>Refresh</span>
        </Button>
      </div>
    </nav>
    <div className="pm-ticket-page__content">
      <PmCentralIntakeInbox
        workspaceId={activeWorkspace?.id ?? null}
        workspaceName={activeWorkspace?.name ?? null}
        workspaceCanReview={activeWorkspace?.role === 'pm'}
        initialSelection={initialSelection}
        onAccepted={(reference, ticketId) => {
          showToast('Inquiry accepted', `${reference} is open in Tickets. Start or link its project from there.`, 'success');
          // Open the request itself, not just the Tickets list.
          setOpenTicket(ticketId);
          setActiveTab('tickets');
        }}
        refreshToken={refreshToken}
      />
    </div>
  </div>;
}
