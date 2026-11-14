import { useMemo } from 'react';
import { MessageSquare, Pin, Search } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { byChatActivity, chatMatches } from './chatDirectory';
import { projectChatStorageKey, useProjectChatPins } from './useProjectChatPins';

const PAGE_SIZE = 25;
export function ChatHistory() {
  const { chatThreads, projects, openChatThread, chatThreadsLoadState, retryChatThreads, identity, currentUser, activeWorkspaceId } = useApp();
  const [pinned, setPinned] = useProjectChatPins(projectChatStorageKey(identity?.login ?? currentUser.id, activeWorkspaceId));
  const [projectId, setProjectId] = useTabSessionState('chat.history.project', '');
  const [query, setQuery] = useTabSessionState('chat.history.query', '');
  const [page, setPage] = useTabSessionState('chat.history.page', 0);
  const projectsById = useMemo(() => new Map(projects.map(project => [project.id, project])), [projects]);
  const matches = useMemo(() => chatThreads
    .filter(thread => (!projectId || (projectId === 'unassigned' ? !thread.projectId : thread.projectId === projectId))
      && chatMatches(thread, projectsById.get(thread.projectId ?? ''), query)).sort(byChatActivity), [chatThreads, projectId, projectsById, query]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const control = 'min-h-9 rounded-lg border border-control bg-surface px-3 text-sm text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

  return <section className="h-full overflow-y-auto bg-shell px-4 py-6 sm:px-7" aria-label="Chat history">
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold text-content">All chats</h1>
      <div className="mb-4 mt-4 flex flex-wrap gap-2">
        <label className={control + ' flex min-w-48 flex-1 items-center gap-2'}>
          <Search className="h-4 w-4 text-content-muted" aria-hidden="true" />
          <input type="search" aria-label="Search chats" placeholder="Search by chat or project" value={query} className="min-w-0 flex-1 bg-transparent text-content"
            onChange={event => { setQuery(event.target.value); setPage(0); }} />
        </label>
        <select aria-label="Filter by project" value={projectId} className={control + ' max-w-full'}
          onChange={event => { setProjectId(event.target.value); setPage(0); }}>
          <option value="">All projects</option>
          <option value="unassigned">No project</option>
          {projects.filter(project => project.assigned !== false).slice().sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)) || a.name.localeCompare(b.name))
            .map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        {projectId && projectsById.has(projectId) && <button type="button" className={control + ' flex items-center gap-2'}
          aria-pressed={pinned.includes(projectId)} onClick={() => setPinned(previous => previous.includes(projectId) ? previous.filter(id => id !== projectId) : [...previous, projectId])}>
          <Pin className="h-3.5 w-3.5" aria-hidden="true" />{pinned.includes(projectId) ? 'Unpin project' : 'Pin project'}
        </button>}
      </div>
      {chatThreadsLoadState === 'loading' && <p role="status" className="text-sm text-content-muted">Loading chats…</p>}
      {['stale', 'error'].includes(chatThreadsLoadState) && <p role="status" className="mb-3 text-sm text-status-warning">
        {chatThreadsLoadState === 'stale' ? 'Showing saved chats. ' : 'Chats unavailable. '}
        <button type="button" className="underline" onClick={() => void retryChatThreads()}>Retry</button>
      </p>}
      {chatThreadsLoadState !== 'loading' && chatThreadsLoadState !== 'error' && !matches.length && <p className="text-sm text-content-muted">No chats match.</p>}
      <ul className="divide-y divide-divider">
        {matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(thread => <li key={thread.id}>
          <button type="button" onClick={() => openChatThread(thread.id)} className="flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <MessageSquare className="h-4 w-4 shrink-0 text-content-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-content">{thread.title}</span>
              <span className="block truncate text-xs text-content-muted">{projectsById.get(thread.projectId ?? '')?.name ?? (thread.projectId ? 'Project chat' : 'No project')}</span>
            </span>
            <time dateTime={thread.lastMessageAt} className="text-xs text-content-muted">{new Date(thread.lastMessageAt).toLocaleDateString()}</time>
          </button>
        </li>)}
      </ul>
      {pages > 1 && <div className="mt-4 flex items-center justify-between gap-2 text-xs text-content-secondary">
        <button type="button" className={control + ' disabled:opacity-40'} disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span aria-live="polite">Page {currentPage + 1} of {pages}</span>
        <button type="button" className={control + ' disabled:opacity-40'} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
      </div>}
    </div>
  </section>;
}
