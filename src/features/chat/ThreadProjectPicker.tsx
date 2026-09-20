import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FolderGit2, Loader2 } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
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
  const { projects, showToast } = useApp();

  const [selected, setSelected] = useState<string>(projectId ?? '');
  const [workspaceDir, setWorkspaceDir] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const choose = async (next: string) => {
    setOpen(false);
    const previous = selected;
    setSelected(next);
    setBusy(true);

    try {
      const updated = await apiService.setThreadProject(threadId, next || null);
      setWorkspaceDir(updated.workspaceDir ?? null);

      if (next && !updated.workspaceDir) {
        // Picking a project with nothing checked out is not an error — the
        // thread simply falls back to the managed root — but silently doing so
        // would look like it worked.
        showToast(
          'No working copy',
          'That project has no checked-out folder, so agents will read the managed workspace root.',
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

  const selectedProject = projects.find(project => project.id === selected);
  const selectedLabel = selectedProject
    ? `${selectedProject.key} · ${selectedProject.name}`
    : 'No project';

  const optionClass = (isSelected: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] transition-colors ${
      isSelected
        ? 'bg-brand-500/15 text-white'
        : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
    }`;

  return (
    <div className="flex items-center gap-1.5">
      <div ref={menuRef} className="relative">
        <button
          type="button"
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          title={
            workspaceDir
              ? `Agents in this thread read ${workspaceDir}`
              : 'Agents in this thread read the managed workspace root'
          }
          className="h-8 min-w-[174px] max-w-[220px] flex items-center gap-2 rounded-md border border-white/[0.10] bg-surface-100/80 px-2.5 text-[11px] text-gray-200 transition-colors hover:border-white/20 focus:outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-gray-500" />
          <span className="min-w-0 flex-1 truncate text-left">{selectedLabel}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Choose a project for this thread"
            className="absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-white/[0.12] bg-surface-raised shadow-2xl shadow-black/40 animate-slide-up"
          >
            <div className="border-b border-white/[0.08] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                Thread project
              </div>
              <div className="mt-0.5 text-[11px] text-gray-600">
                Agents read from this project's working copy.
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto py-1">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!selected}
                onClick={() => void choose('')}
                className={optionClass(!selected)}
              >
                <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                <span className="min-w-0 flex-1 truncate">No project</span>
                {!selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-400" />}
              </button>

              {projects.length > 0 && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                  Projects
                </div>
              )}

              {projects.map(project => {
                const isSelected = selected === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    onClick={() => void choose(project.id)}
                    className={optionClass(isSelected)}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-500/15 text-[10px] font-semibold text-brand-300">
                      {project.key.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{project.key}</span>
                      <span className="text-gray-500"> · {project.name}</span>
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-400" />}
                  </button>
                );
              })}

              {projects.length === 0 && (
                <div className="px-3 py-3 text-[11px] text-gray-600">No projects available.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <select
        style={{ display: 'none' }}
        value={selected}
        disabled={busy}
        onChange={e => void choose(e.target.value)}
        title={
          workspaceDir
            ? `Agents in this thread read ${workspaceDir}`
            : 'Agents in this thread read the managed workspace root'
        }
        className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-300 hover:border-white/20 focus:outline-none focus:border-white/30 disabled:opacity-50 max-w-[180px] truncate"
      >
        <option value="">No project</option>
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
    </div>
  );
}
