import { useEffect, useState } from 'react';
import { FolderGit2, Loader2 } from 'lucide-react';

import { useApp } from '@/app/AppContext';

/**
 * Which project a conversation is about.
 *
 * This decides the directory the agents in this thread can read. Without it a
 * chat was pinned to the managed workspace root, so an agent asked to review a
 * repository found an empty directory and said so — while a run on the same
 * project read the real thing.
 *
 * The resolved path is shown, not just the project name. A project can hold
 * more than one working copy (a repository Alpha scaffolded, and a folder
 * attached by hand) and the resolver prefers the managed one, so the project
 * you pick and the directory you get are not always the obvious pairing.
 */

interface Props {
  threadId: string;
  projectId?: string;
}

export function ThreadProjectPicker({ threadId, projectId }: Readonly<Props>) {
  const { projects, showToast, can, setThreadProject } = useApp();
  const canManageChat = can('manage_chat');

  const [selected, setSelected] = useState<string>(projectId ?? '');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [workspaceManaged, setWorkspaceManaged] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(projectId ?? '');
  }, [projectId]);

  const choose = async (next: string) => {
    if (!canManageChat) return;
    const previous = selected;
    setSelected(next);
    setBusy(true);

    try {
      const updated = await setThreadProject(threadId, next || null);
      setWorkspaceDir(updated.workspaceDir ?? null);
      setWorkspaceManaged(updated.workspaceManaged ?? null);

      if (next && !updated.workspaceDir) {
        showToast(
          'No working copy',
          'This project has no local working copy. General chat is available, but code review and revisions need a connected repository.',
          'info'
        );
      }
    } catch (err: any) {
      setSelected(previous);
      showToast('Project not set', err?.message ?? String(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <FolderGit2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />

      <select
        value={selected}
        disabled={busy || !canManageChat}
        onChange={e => void choose(e.target.value)}
        title={
          workspaceDir
            ? `Project working copy: ${workspaceDir}`
            : 'Choose a project with a connected working copy for code-aware agent calls.'
        }
        className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-300 hover:border-white/20 focus:outline-none focus:border-white/30 disabled:opacity-50 max-w-[180px] truncate"
      >
        {!selected && <option value="" disabled>Select project</option>}
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.key} — {p.name}
          </option>
        ))}
      </select>

      {busy && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}

      {/* The directory, once known. Truncated from the left: the tail is the
          part that distinguishes one working copy from another. */}
      {workspaceDir && !busy && (
        <span
          dir="rtl"
          title={workspaceDir}
          className="font-mono text-[10px] text-gray-600 truncate max-w-[200px] hidden lg:inline"
        >
          {workspaceDir}
        </span>
      )}
      {workspaceDir && !busy && (
        <span className="hidden xl:inline text-[10px] text-gray-500">
          {workspaceManaged ? 'managed copy' : 'attached folder'}
        </span>
      )}
    </div>
  );
}
