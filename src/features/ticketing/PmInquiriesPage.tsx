import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { PmCentralIntakeInbox } from './PmCentralIntakeInbox';

/** Shared inquiry intake as a distinct PM sidebar destination. */
export function PmInquiriesPage() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { activeWorkspace, setActiveTab, showToast } = useApp();

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
        onAccepted={reference => {
          showToast('Inquiry accepted', `${reference} was created in ${activeWorkspace?.name ?? 'your workspace'}. It is now in Tickets; client invitation and access remain separate.`, 'success');
          setActiveTab('tickets');
        }}
        refreshToken={refreshToken}
      />
    </div>
  </div>;
}
