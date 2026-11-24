import { useEffect, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { pmTicketApi } from './pmApi';

const intakeEnabled = import.meta.env.VITE_TICKETING_ENABLED !== '0';

/**
 * Which ticket actions this backend offers. Triage until it confirms the
 * optional Phase 7–9 workflow endpoints. Shared by Inquiries and Clients.
 */
export function usePmWorkflowActions(): 'triage' | 'all' {
  const [workflowActions, setWorkflowActions] = useState<'triage' | 'all'>('triage');
  const { activeWorkspace } = useApp();
  useEffect(() => {
    let current = true;
    setWorkflowActions('triage');
    void pmTicketApi.getWorkflowCapabilities().then(capabilities => {
      if (current && capabilities.phaseWorkflowEnabled) setWorkflowActions('all');
    }).catch(() => {
      // Keep the existing triage path available when this backend has not
      // enabled the optional Phase 7–9 endpoints.
    });
    return () => { current = false; };
  }, [activeWorkspace?.id]);
  return workflowActions;
}

/** The ticketing rollout switch shared by Inquiries and Clients. */
export const pmTicketsIntakeEnabled = intakeEnabled;
