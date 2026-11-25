import React, { useEffect, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { pmTicketApi, type PmClientSummary } from '@/features/ticketing/pmApi';
import { ProjectStageTracker } from '@/features/ticketing/ProjectStageTracker';
import { CLIENTS_CONVERSATION_FOCUS_KEY } from '@/features/ticketing/TaskClientRequest';
import type { StageSummary } from '@/features/ticketing/projectStages';
import { clientAccountId } from '@/features/pm-inbox/inboxItems';

/**
 * The client stage at the top of a project, for its project manager: where the project is
 * (POC, Development, Completed), whose turn it is, and the way to the client conversation where
 * the next step happens. Nothing shows for a project without a client.
 */
export const ProjectStageStrip: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { activeTabId, setTabSessionState, setActiveTab } = useApp();
  const [stage, setStage] = useState<{ client: PmClientSummary; summary: StageSummary } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStage(null);
    void (async () => {
      try {
        const clients = await pmTicketApi.listClients();
        const client = clients.find(item => item.projects.some(project => project.projectId === projectId));
        const accountId = client ? clientAccountId(client) : null;
        if (!client || !accountId) return;
        const summary = await pmTicketApi.getProjectStage(projectId, accountId);
        if (!cancelled) setStage({ client, summary });
      } catch {
        // No stage to show: the project has no client, or this server has no stages.
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (!stage) return null;
  const openConversation = () => {
    setTabSessionState(activeTabId, 'clients.selected', stage.client.key);
    setTabSessionState(activeTabId, 'clients.section', 'conversation');
    setTabSessionState(activeTabId, CLIENTS_CONVERSATION_FOCUS_KEY, { projectId });
    setActiveTab('clients');
  };
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-y border-divider bg-surface px-4 py-2 sm:px-5">
      <span className="text-xs font-medium text-content-muted">{stage.client.displayName}</span>
      <div className="min-w-0 flex-1"><ProjectStageTracker summary={stage.summary} role="pm" /></div>
      <Button variant="outline" size="sm" onClick={openConversation}>Open client conversation</Button>
    </div>
  );
};

