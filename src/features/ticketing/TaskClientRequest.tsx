import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { pmTicketApi, type PmTaskRequestLink } from './pmApi';
import { REQUEST_TASK_LINKED_EVENT } from './requestTaskLink';

/** The Clients page reads this to open a conversation on a project and request. */
export const CLIENTS_CONVERSATION_FOCUS_KEY = 'clients.conversationFocus';

const cache = new Map<string, { at: number; items: PmTaskRequestLink[] }>();
const FRESH_MS = 30_000;

async function linksFor(projectId: string, api: typeof pmTicketApi): Promise<PmTaskRequestLink[]> {
  const cached = cache.get(projectId);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.items;
  const { items } = await api.listTaskRequestLinks(projectId);
  cache.set(projectId, { at: Date.now(), items });
  return items;
}

/**
 * In a task's details: the client request the task was made for, linking to
 * that client's conversation. Shows nothing for a task with no request, or for
 * someone who does not work with clients.
 */
export function TaskClientRequest({ issueId, projectId, api = pmTicketApi }: { issueId: string; projectId: string; api?: typeof pmTicketApi }) {
  const { visibleTabs, activeTabId, setTabSessionState, setActiveTab } = useApp();
  const canSeeClients = (visibleTabs ?? []).includes('clients');
  const [link, setLink] = useState<PmTaskRequestLink | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => { cache.delete(projectId); setVersion(value => value + 1); };
    window.addEventListener(REQUEST_TASK_LINKED_EVENT, refresh);
    return () => window.removeEventListener(REQUEST_TASK_LINKED_EVENT, refresh);
  }, [projectId]);

  useEffect(() => {
    setLink(null);
    if (!canSeeClients || !projectId) return;
    let current = true;
    void linksFor(projectId, api).then(items => { if (current) setLink(items.find(item => item.issueId === issueId) ?? null); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [api, canSeeClients, issueId, projectId, version]);

  if (!link) return null;
  const open = () => {
    if (!link.clientId) return;
    setTabSessionState(activeTabId, 'clients.selected', `client:${link.clientId}`);
    setTabSessionState(activeTabId, 'clients.section', 'conversation');
    setTabSessionState(activeTabId, CLIENTS_CONVERSATION_FOCUS_KEY, { projectId, ticketId: link.ticketId });
    setActiveTab('clients');
  };
  return <section aria-label="Client request" className="border-b border-divider pb-4">
    <p className="mb-1 text-[11px] font-medium text-content-muted">Client request</p>
    <button type="button" onClick={open} disabled={!link.clientId}
      className="inline-flex max-w-full items-center gap-1.5 text-left text-[12.5px] font-medium text-link hover:underline disabled:cursor-default disabled:text-content-secondary disabled:no-underline">
      <MessageSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{link.title}</span>
    </button>
  </section>;
}
