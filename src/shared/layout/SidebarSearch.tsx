import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { CheckSquare, FolderKanban, MessageSquare } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { NAV_ITEMS, navIcon, navLabel } from '@/config/navigation';
import { byChatActivity, chatMatches } from '@/features/chat/chatDirectory';
import { sidebarRow } from '@/features/chat/ProjectChatSidebar';
import { fitEntries, LABEL_HEIGHT, ROW_HEIGHT, useFitHeight } from './useFitHeight';

export interface SidebarSearchResult {
  id: string;
  group: 'Pages' | 'Chats' | 'Tasks' | 'Projects';
  label: string;
  detail?: string;
  icon: ReactNode;
  run: () => void;
}

const includesAll = (text: string, query: string) =>
  query.toLowerCase().trim().split(/\s+/).every(word => text.toLowerCase().includes(word));

/** Everything the sidebar can find by typing: pages, chats, tasks and projects this person can open. */
export function useSidebarSearch(query: string, chatInSidebar: boolean): SidebarSearchResult[] {
  const {
    role, visibleTabs, setActiveTab, activeTabId, setTabSessionState, chatThreads, projects, issues,
    openChatThread, can, workspaceLoading, workspaceSwitching,
  } = useApp();
  return useMemo(() => {
    if (!query.trim() || workspaceLoading || workspaceSwitching) return [];
    const projectsById = new Map(projects.map(project => [project.id, project]));
    const open = (view: Parameters<typeof setActiveTab>[0], state: Record<string, unknown> = {}) => {
      Object.entries(state).forEach(([key, value]) => setTabSessionState(activeTabId, key, value));
      setActiveTab(view);
    };
    const pages = NAV_ITEMS.filter(item => visibleTabs.includes(item.id) && !(chatInSidebar && item.id === 'chat')
      && includesAll(navLabel(item.id, role) + ' ' + item.title, query))
      .map((item): SidebarSearchResult => ({ id: 'page:' + item.id, group: 'Pages', label: navLabel(item.id, role),
        icon: navIcon(item.id, 'h-3.5 w-3.5'), run: () => open(item.id) }));
    const chats = chatInSidebar && can('manage_chat')
      ? chatThreads.filter(thread => chatMatches(thread, projectsById.get(thread.projectId ?? ''), query)).sort(byChatActivity)
        .map((thread): SidebarSearchResult => ({ id: 'chat:' + thread.id, group: 'Chats', label: thread.title,
          detail: projectsById.get(thread.projectId ?? '')?.name, icon: <MessageSquare className="h-3.5 w-3.5" />,
          run: () => openChatThread(thread.id) }))
      : [];
    const tasks = visibleTabs.includes('issues')
      ? issues.filter(issue => includesAll(issue.identifier + ' ' + issue.title, query))
        .map((issue): SidebarSearchResult => ({ id: 'task:' + issue.id, group: 'Tasks', label: issue.title, detail: issue.identifier,
          icon: <CheckSquare className="h-3.5 w-3.5" />,
          run: () => open('issues', { 'issues.project': issue.projectId, 'issues.selectedIssue': issue.id }) }))
      : [];
    const projectResults = visibleTabs.includes('projects')
      ? projects.filter(project => includesAll(project.name + ' ' + project.key, query))
        .map((project): SidebarSearchResult => ({ id: 'project:' + project.id, group: 'Projects', label: project.name,
          detail: project.key, icon: <FolderKanban className="h-3.5 w-3.5" />,
          run: () => open('projects', { 'projects.selectedProject': project.id }) }))
      : [];
    return [...pages, ...chats, ...tasks, ...projectResults];
  }, [query, chatInSidebar, role, visibleTabs, chatThreads, projects, issues, activeTabId, setActiveTab, setTabSessionState,
    openChatThread, can, workspaceLoading, workspaceSwitching]);
}

/** Results replace the sidebar body while a query is typed, and are trimmed to fit the space. */
export function SidebarSearchResults({ results, inputRef, onRun, listId }: {
  results: SidebarSearchResult[];
  inputRef: RefObject<HTMLInputElement>;
  onRun: (result: SidebarSearchResult) => void;
  listId: string;
}) {
  const [ref, available] = useFitHeight<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState(0);
  const groups = [...new Set(results.map(result => result.group))];
  // Each group gets a fair share first, so a long chat list cannot hide every task; spare rows then go to groups in order.
  const byGroup = groups.map(group => results.filter(result => result.group === group));
  let spare = Math.max(groups.length, Math.floor((available - 24 - groups.length * LABEL_HEIGHT) / ROW_HEIGHT));
  const share = Math.max(1, Math.floor(spare / Math.max(1, groups.length)));
  const counts = byGroup.map(items => Math.min(items.length, share));
  spare -= counts.reduce((sum, count) => sum + count, 0);
  byGroup.forEach((items, index) => { const extra = Math.min(Math.max(0, spare), items.length - counts[index]); counts[index] += extra; spare -= extra; });
  const entries = groups.flatMap((group, index) => [
    { key: 'label:' + group, height: LABEL_HEIGHT, label: true as const, group },
    ...byGroup[index].slice(0, counts[index]).map(result => ({ key: result.id, height: ROW_HEIGHT, result })),
  ]);
  const shown = fitEntries(entries, Math.max(0, available - 24));
  const visible = shown.flatMap(entry => 'result' in entry && entry.result ? [entry.result] : []);
  const active = visible[Math.min(activeIndex, visible.length - 1)];
  const hidden = results.length - visible.length;

  useEffect(() => setActiveIndex(0), [results]);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    if (active) input.setAttribute('aria-activedescendant', active.id); else input.removeAttribute('aria-activedescendant');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (visible.length) setActiveIndex(index => (Math.min(index, visible.length - 1) + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length);
      } else if (event.key === 'Enter' && active) {
        event.preventDefault();
        onRun(active);
      }
    };
    input.addEventListener('keydown', onKeyDown);
    return () => { input.removeEventListener('keydown', onKeyDown); input.removeAttribute('aria-activedescendant'); };
  }, [active, visible, inputRef, onRun]);

  return <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
    {available > 0 && <div id={listId} role="listbox" aria-label="Search results">
      {shown.map(entry => 'result' in entry && entry.result ? (
        <button key={entry.key} id={entry.result.id} type="button" role="option" tabIndex={-1}
          aria-selected={entry.result === active}
          onMouseDown={event => event.preventDefault()} onClick={() => onRun(entry.result!)}
          className={sidebarRow + ' w-full ' + (entry.result === active ? 'bg-surface-high text-content' : '')}>
          <span className="shrink-0 text-content-muted">{entry.result.icon}</span>
          <span className="min-w-0 flex-1 truncate">{entry.result.label}</span>
          {entry.result.detail && <span className="sidebar-detail max-w-[40%] truncate text-[11px] text-content-muted">{entry.result.detail}</span>}
        </button>
      ) : <p key={entry.key} role="presentation" className="flex h-7 items-end px-2 pb-1 text-[11px] font-medium text-content-muted">{'group' in entry ? entry.group : ''}</p>)}
    </div>}
    <p role="status" className="px-2 pt-1 text-[11px] text-content-muted">
      {available > 0 && (!results.length ? 'No matches' : hidden > 0 ? hidden + ' more · refine your search' : '')}
    </p>
  </div>;
}
