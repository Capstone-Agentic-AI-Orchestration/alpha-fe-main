import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { pmTicketApi } from '@/features/ticketing/pmApi';
import {
  agentChangesAttention, buildAttention, clientAttention, inquiriesAttention, sortAttention, type AttentionItem
} from './attentionItems';

/** How often the list is read again while the window is in view. */
const REFRESH_MS = 120_000;

interface AttentionState {
  items: AttentionItem[];
  loading: boolean;
  /** Some sources could not be read, so the list may be short. */
  incomplete: boolean;
  checkedAt: string | null;
  refresh: () => Promise<void>;
}

const AttentionContext = createContext<AttentionState>({
  items: [], loading: false, incomplete: false, checkedAt: null, refresh: async () => undefined
});

/**
 * One reading of the list for the whole window, so the sidebar count and the page agree and the
 * sources are read once. Builds and agent board changes come from this desktop's own daemon;
 * clients and inquiries come from the shared API, which is why the list refreshes every two
 * minutes and only while the window is visible.
 */
export const AttentionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { can, visibleTabs, issues, projects, activeWorkspaceId } = useApp();
  const [items, setItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const enabled = visibleTabs.includes('attention');
  const readsBuilds = isDesktop && can('run_builds');
  const readsAgentChanges = isDesktop && visibleTabs.includes('issues');
  const readsClients = visibleTabs.includes('clients');
  const readsInquiries = visibleTabs.includes('inquiries');
  // Titles are read from the latest board, but a board update alone does not re-read the sources.
  const latest = useRef({ issues, projects });
  latest.current = { issues, projects };
  const projectIds = useMemo(() => projects.map(project => project.id).join('|'), [projects]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { issues, projects } = latest.current;
    const issuesById = new Map(issues.map(issue => [issue.id, issue]));
    const projectsById = new Map(projects.map(project => [project.id, project]));
    const sources = await Promise.allSettled([
      readsBuilds
        ? apiService.getIssueBuildStatuses().then(rows => rows.map(build =>
          buildAttention(build, issuesById.get(build.issueId), projectsById.get(build.projectId))))
        : Promise.resolve([]),
      readsAgentChanges
        ? Promise.all(projects.map(project => apiService.getBoardAgentChanges(project.id, 'held')
          .then(changes => agentChangesAttention(changes, project))))
        : Promise.resolve([]),
      readsClients ? pmTicketApi.listClients().then(clients => clients.map(clientAttention)) : Promise.resolve([]),
      readsInquiries
        ? pmTicketApi.listCentralIntakes(null, 'pending').then(page => [inquiriesAttention(
          page.items.length, Boolean(page.nextCursor), page.items.map(item => item.submittedAt).sort()[0])])
        : Promise.resolve([]),
    ]);
    const found = sources.flatMap(source => source.status === 'fulfilled' ? source.value : [])
      .filter((item): item is AttentionItem => Boolean(item));
    setItems(sortAttention(found));
    setIncomplete(sources.some(source => source.status === 'rejected'));
    setCheckedAt(new Date().toISOString());
    setLoading(false);
    // A new set of projects, or another workspace, means reading the sources again.
  }, [enabled, readsBuilds, readsAgentChanges, readsClients, readsInquiries, projectIds, activeWorkspaceId]);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  const value = useMemo(() => ({ items, loading, incomplete, checkedAt, refresh }), [items, loading, incomplete, checkedAt, refresh]);
  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
};

export const useAttention = () => useContext(AttentionContext);

