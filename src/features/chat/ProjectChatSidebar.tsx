import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, FolderOpen, MessageSquare, MoreHorizontal, Pin, Plus } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage';
import { isDesktop } from '@/shared/desktop';
import { entriesHeight, fitEntries, LABEL_HEIGHT, ROW_HEIGHT, useFitHeight, type FitEntry } from '@/shared/layout/useFitHeight';
import type { ChatThread, Project } from '@/shared/types';
import { CreateProjectModal } from '@/features/projects/CreateProjectModal';
import { ChatThreadDialogs } from './ChatThreadDialogs';
import { projectChatShortlist } from './chatDirectory';
import { useProjectChatPins } from './useProjectChatPins';

export const sidebarRow = 'flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-left text-[13px] text-content-secondary hover:bg-surface-high hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';
// Row actions take no space until the row is hovered or focused, so narrow sidebars keep full names.
const iconButton = 'hidden h-7 w-7 shrink-0 place-items-center rounded-md text-content-muted hover:bg-surface-high hover:text-content focus-visible:ring-2 focus-visible:ring-focus group-hover:grid group-focus-within:grid data-[state=open]:grid';
const sectionLabel = 'flex h-7 items-end px-2 pb-1 text-[11px] font-medium text-content-muted';

type Entry = FitEntry & { node: ReactNode; threadId?: string };

/** Chats only: project folders and recent conversations, sized to fit the sidebar without scrolling. */
export function ProjectChatSidebar({ onNavigate, storageKey }: { onNavigate: () => void; storageKey: string }) {
  const {
    tabs, activeTabId, chatThreads, chatThreadsLoadState, retryChatThreads, chatTypingByThread,
    projects, openChatDraft, openChatThread, openChatHistory, openNewTab, can,
  } = useApp();
  const [listRef, available] = useFitHeight<HTMLDivElement>();
  const [pinned, setPinned] = useProjectChatPins(storageKey);
  const [expanded, setExpanded] = useState(() => loadFromStorage<string[]>(storageKey + '.expanded', []));
  const [creating, setCreating] = useState(false);
  const [threadPendingDelete, setThreadPendingDelete] = useState<Pick<ChatThread, 'id' | 'title'> | null>(null);
  const [memoryThreadId, setMemoryThreadId] = useState<string | null>(null);
  const activeTab = tabs.find(tab => tab.id === activeTabId && tab.view === 'chat' && !tab.sessionState?.['chat.history']);
  const activeThread = chatThreads.find(thread => thread.id === activeTab?.sessionState?.activeThreadId);
  const activeProject = activeThread?.projectId ?? activeTab?.sessionState?.['chat.session.draft.projectId'];
  const shortlist = useMemo(() => projectChatShortlist(projects, chatThreads, pinned,
    typeof activeProject === 'string' ? activeProject : undefined), [projects, chatThreads, pinned, activeProject]);

  useEffect(() => {
    if (typeof activeProject === 'string' && activeProject) setExpanded(current => current.includes(activeProject) ? current : [...current, activeProject]);
  }, [activeProject, activeThread?.id]);
  useEffect(() => { saveToStorage(storageKey + '.expanded', expanded); }, [expanded, storageKey]);

  const go = (action: () => void) => { action(); onNavigate(); };
  const working = (thread: ChatThread) => Boolean(chatTypingByThread[thread.id]);
  const togglePin = (id: string) => setPinned(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);

  const threadRow = (thread: ChatThread, projectName?: string): Entry => {
    const selected = activeThread?.id === thread.id;
    return { key: 'thread:' + (projectName === undefined ? '' : 'recent:') + thread.id, height: ROW_HEIGHT, threadId: thread.id, node:
      <div className="group flex items-center">
        <button type="button" aria-current={selected ? 'true' : undefined}
          className={sidebarRow + ' flex-1 ' + (selected ? 'bg-selected font-medium text-selected-content hover:bg-selected' : '')}
          title={[thread.title, projectName].filter(Boolean).join(' · ')}
          onClick={() => go(() => openChatThread(thread.id))}>
          {working(thread)
            ? <span className="mx-[3px] h-2 w-2 shrink-0 rounded-full bg-action motion-safe:animate-pulse" role="img" aria-label="Responding" />
            : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate">{thread.title}</span>
          {projectName && <span className="sidebar-detail max-w-[40%] truncate text-[11px] text-content-muted">{projectName}</span>}
        </button>
        {projectName === undefined && <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild><button type="button" aria-label={'Options for ' + thread.title} className={iconButton}><MoreHorizontal className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" data-sidebar-overlay="">
            {isDesktop && <DropdownMenuItem onSelect={() => setMemoryThreadId(thread.id)}>Session memory</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => setThreadPendingDelete(thread)} className="text-status-danger">Delete chat</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>}
      </div> };
  };

  const projectEntries = (project: Project, threads: ChatThread[]): Entry[] => {
    const open = expanded.includes(project.id);
    const running = !open && threads.some(working);
    const header: Entry = { key: 'project:' + project.id, height: ROW_HEIGHT, node:
      <div className="group flex items-center">
        <button type="button" className={sidebarRow + ' flex-1 font-medium text-content'} aria-expanded={open} title={project.name}
          onClick={() => setExpanded(previous => open ? previous.filter(id => id !== project.id) : [...previous, project.id])}>
          <ChevronRight className={'h-3 w-3 shrink-0 text-content-muted motion-safe:transition-transform ' + (open ? 'rotate-90' : '')} aria-hidden="true" />
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
          <span className="truncate">{project.name}</span>
          {pinned.includes(project.id) && <Pin className="h-3 w-3 shrink-0 text-content-muted" aria-label="Pinned" />}
          {running && <span className="h-2 w-2 shrink-0 rounded-full bg-action" role="img" aria-label="Chat responding" />}
        </button>
        <button type="button" className={iconButton} aria-label={'New chat in ' + project.name} title="New chat in this project" onClick={() => go(() => openChatDraft(project.id))}><Plus className="h-3.5 w-3.5" /></button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild><button type="button" className={iconButton} aria-label={'Options for ' + project.name}><MoreHorizontal className="h-3.5 w-3.5" /></button></DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" data-sidebar-overlay="">
            <DropdownMenuItem onSelect={() => togglePin(project.id)}>{pinned.includes(project.id) ? 'Unpin project' : 'Pin project'}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go(() => openNewTab('projects', { 'projects.selectedProject': project.id }))}>Open project</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => go(() => openChatHistory(project.id))}>View all chats</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div> };
    if (!open) return [header];
    const visible = threads.slice(0, 3);
    if (activeThread?.projectId === project.id && !visible.includes(activeThread)) visible.push(activeThread);
    const nested = (entry: Entry): Entry => ({ ...entry, node: <div className="ml-[15px] border-l border-divider pl-1.5">{entry.node}</div> });
    return [header, ...visible.map(thread => nested(threadRow(thread))),
      ...(!threads.length ? [nested({ key: 'empty:' + project.id, height: LABEL_HEIGHT, node: <p className="flex h-7 items-center px-2 text-xs text-content-muted">No chats yet</p> })] : []),
      ...(threads.length > visible.length ? [nested({ key: 'more:' + project.id, height: LABEL_HEIGHT, node:
        <button type="button" className={sidebarRow + ' h-7 w-full text-xs text-content-muted'} onClick={() => go(() => openChatHistory(project.id))}>View all {threads.length}</button> })] : [])];
  };

  const status: Entry[] = chatThreadsLoadState === 'loading' && !chatThreads.length
    ? [{ key: 'status', height: LABEL_HEIGHT, node: <p role="status" className="flex h-7 items-center px-2 text-xs text-content-muted">Loading chats…</p> }]
    : ['error', 'stale'].includes(chatThreadsLoadState)
      ? [{ key: 'status', height: LABEL_HEIGHT, node: <p role="status" className="flex h-7 items-center gap-1 px-2 text-xs text-status-warning">
          {chatThreadsLoadState === 'stale' ? 'Showing saved chats.' : 'Chats unavailable.'}
          <button type="button" className="underline" onClick={() => void retryChatThreads()}>Retry</button></p> }]
      : [];
  const projectsLabel: Entry = { key: 'label:projects', height: LABEL_HEIGHT, label: true, node:
    <div className="group flex items-end justify-between pr-0.5"><h3 className={sectionLabel}>Projects</h3>
      {can('create_project') && <button type="button" className={iconButton + ' mb-0.5 h-6 w-6'} aria-label="Create project" title="Create project" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /></button>}
    </div> };

  /** Fit projects first, keep room for a few recent chats, and keep the open conversation on screen. */
  const layout = (groups: typeof shortlist.visible) => {
    const projectRows = [projectsLabel, ...groups.flatMap(({ project, threads }) => projectEntries(project, threads))];
    const budget = Math.max(0, available - entriesHeight(status));
    const recentReserve = shortlist.recent.length ? LABEL_HEIGHT + ROW_HEIGHT * Math.min(2, shortlist.recent.length) : 0;
    const shownProjects = fitEntries(projectRows, Math.max(budget - recentReserve, Math.min(budget, entriesHeight(projectRows.slice(0, 2)))));
    const shownIds = new Set(shownProjects.map(entry => entry.threadId).filter(Boolean));
    const recentRows: Entry[] = [{ key: 'label:recent', height: LABEL_HEIGHT, label: true, node: <h3 className={sectionLabel}>Recent</h3> },
      ...shortlist.recent.filter(thread => !shownIds.has(thread.id)).map(thread =>
        threadRow(thread, projects.find(project => project.id === thread.projectId)?.name ?? ''))];
    return [...shownProjects, ...fitEntries(recentRows, budget - entriesHeight(shownProjects))];
  };
  let shown = layout(shortlist.visible);
  if (activeThread && !shown.some(entry => entry.threadId === activeThread.id)) {
    const activeGroup = shortlist.visible.find(group => group.project.id === activeThread.projectId);
    if (activeGroup) shown = layout([activeGroup, ...shortlist.visible.filter(group => group !== activeGroup)]);
  }

  return <section aria-label="Chats" className="flex min-h-0 flex-1 flex-col">
    <div ref={listRef} className="min-h-0 flex-1 overflow-hidden">
      {available > 0 && [...status, ...shown].map(entry => <div key={entry.key} style={{ height: entry.height }}>{entry.node}</div>)}
    </div>
    <CreateProjectModal isOpen={creating} onClose={() => setCreating(false)} onCreated={project => go(() => openChatDraft(project.id))} />
    <ChatThreadDialogs threadPendingDelete={threadPendingDelete} setThreadPendingDelete={setThreadPendingDelete}
      memoryThreadId={memoryThreadId} setMemoryThreadId={setMemoryThreadId} />
  </section>;
}
