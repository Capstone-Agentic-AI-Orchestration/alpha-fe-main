import React, { useId, useState } from 'react';
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { Modal } from '@/shared/components/Modal';
import type { Project } from '@/shared/types';
import { repoNameWithOwner } from './DeleteRepositoryConfirm';

/** The GitHub repositories attached to a project, as owner/name. */
export function projectRepositories(project: Project): string[] {
  return (project.resources ?? [])
    .filter(resource => resource.type === 'github_repo')
    .map(resource => repoNameWithOwner(resource.pathOrUrl))
    .filter((repo): repo is string => Boolean(repo));
}

type Choice = 'archive' | 'delete';

/** The dialog's main button, for what is chosen and whether it is running. */
function actionLabel(choice: Choice, busy: boolean, withRepositories: boolean): string {
  if (choice === 'archive') return busy ? 'Archiving…' : 'Archive project';
  if (!busy) return 'Delete project';
  return withRepositories ? 'Deleting… hosting first' : 'Deleting…';
}

interface ProjectRemovalDialogProps {
  project: Project;
  /** Opens on Delete, for an already archived project. */
  initialChoice?: Choice;
  /** Whether this person may delete repositories (and so their hosting). */
  canDeleteRepositories: boolean;
  onArchive: () => Promise<boolean>;
  /** `repositoriesConfirm` is the typed key when the repositories go too. */
  onDelete: (repositoriesConfirm?: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Archive or delete a project. Archive is the default and can be undone;
 * Delete removes the project and, by default, its repositories with their
 * hosting, and asks for the project key first.
 */
export const ProjectRemovalDialog: React.FC<ProjectRemovalDialogProps> = ({
  project, initialChoice = 'archive', canDeleteRepositories, onArchive, onDelete, onClose,
}) => {
  const repositories = projectRepositories(project);
  const archived = Boolean(project.archivedAt);
  const [choice, setChoice] = useState<Choice>(archived ? 'delete' : initialChoice);
  const [withRepositories, setWithRepositories] = useState(canDeleteRepositories && repositories.length > 0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmed = typed.trim().toLowerCase() === project.key.toLowerCase();
  const blocked = busy || (choice === 'delete' && !confirmed);
  const repoCount = repositories.length === 1 ? '1 repository' : `${repositories.length} repositories`;

  const submit = async () => {
    if (blocked) return;
    setBusy(true);
    const repositoriesConfirm = withRepositories ? project.key : undefined;
    const done = choice === 'archive' ? await onArchive() : await onDelete(repositoriesConfirm);
    if (done) onClose();
    else setBusy(false);
  };

  const option = (value: Choice, title: string, body: React.ReactNode, Icon: typeof Archive) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${choice === value ? 'border-control bg-surface-high' : 'border-divider hover:bg-surface-high/50'}`}>
      <input type="radio" name="project-removal" value={value} checked={choice === value} disabled={busy}
        onChange={() => setChoice(value)} className="mt-1" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-content"><Icon className="h-3.5 w-3.5" aria-hidden />{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-content-secondary">{body}</span>
      </span>
    </label>
  );

  return (
    <Modal isOpen onClose={onClose} closeDisabled={busy} title={archived ? 'Delete archived project' : 'Archive or delete project'}
      subtitle={`${project.name} · ${project.key}`} maxWidth="max-w-lg"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-3 py-1.5 text-xs text-content-secondary hover:text-content disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={() => void submit()} disabled={blocked}
            className={`rounded-xl px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${choice === 'delete'
              ? 'bg-rose-600 text-on-accent hover:bg-rose-500' : 'bg-action text-on-action hover:bg-action-hover'}`}>
            {actionLabel(choice, busy, withRepositories)}
          </button>
        </div>
      )}>
      <div className="space-y-3 font-sans">
        {!archived && option('archive', 'Archive', <>
          Takes the project off the project lists and boards
          {repositories.length > 0 && <> and makes its {repoCount} read-only on GitHub</>}.
          Tasks, history and client requests stay, and hosting keeps running. You can restore it any time.
        </>, Archive)}
        {option('delete', 'Delete permanently', <>
          Deletes the project with its tasks and history{withRepositories && <>, and deletes its {repoCount} on GitHub with their hosting</>}.
          This can’t be undone.
        </>, Trash2)}

        {choice === 'delete' && (
          <DeleteConfirm projectKey={project.key} repositories={repositories} canDeleteRepositories={canDeleteRepositories}
            withRepositories={withRepositories} onWithRepositories={setWithRepositories}
            typed={typed} onTyped={setTyped} busy={busy} onSubmit={() => void submit()} />
        )}
      </div>
    </Modal>
  );
};

/** What a permanent delete takes with it, and the typed key it needs. */
function DeleteConfirm({ projectKey, repositories, canDeleteRepositories, withRepositories, onWithRepositories, typed, onTyped, busy, onSubmit }: {
  projectKey: string;
  repositories: string[];
  canDeleteRepositories: boolean;
  withRepositories: boolean;
  onWithRepositories: (value: boolean) => void;
  typed: string;
  onTyped: (value: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const keyInput = useId();
  let repositoryChoice: React.ReactNode = null;
  if (repositories.length > 0 && canDeleteRepositories) {
    repositoryChoice = (
      <label className="flex items-start gap-2 text-xs text-content-secondary">
        <input type="checkbox" checked={withRepositories} disabled={busy} onChange={event => onWithRepositories(event.target.checked)} className="mt-0.5" />
        <span>
          Also delete {repositories.map((repo, index) => <React.Fragment key={repo}>{index > 0 && ', '}<code className="font-mono text-content">{repo}</code></React.Fragment>)},
          {' '}their Render or Vercel hosting, and Alpha’s working copies
        </span>
      </label>
    );
  } else if (repositories.length > 0) {
    repositoryChoice = <p className="text-xs text-content-secondary">Its repositories stay on GitHub: deleting them needs a project manager.</p>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-status-danger-border bg-status-danger-subtle p-3">
      {repositoryChoice}
      <label htmlFor={keyInput} className="block text-xs text-content-secondary">
        Type <code className="font-mono text-content">{projectKey}</code> to confirm
      </label>
      <input id={keyInput} type="text" value={typed} onChange={event => onTyped(event.target.value)} disabled={busy}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onSubmit(); } }}
        autoComplete="off" spellCheck={false}
        className="w-full rounded-xl border border-control bg-surface px-3 py-1.5 font-mono text-xs text-content focus:border-status-danger-border focus:outline-none disabled:opacity-50" />
    </div>
  );
}

interface ArchivedProjectsProps {
  projects: Project[];
  canManage: boolean;
  onRestore: (project: Project) => Promise<unknown>;
  onDelete: (project: Project) => void;
}

/** Archived projects, folded away under the project list, with Restore and Delete. */
export const ArchivedProjects: React.FC<ArchivedProjectsProps> = ({ projects, canManage, onRestore, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  if (projects.length === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section aria-label="Archived projects" className="w-full">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
        className="flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-content-muted hover:text-content">
        <Chevron className="h-3.5 w-3.5" aria-hidden />
        Archived <span className="tabular-nums">{projects.length}</span>
      </button>
      {open && (
        <ul className="mt-1 divide-y divide-divider border-y border-divider">
          {projects.map(project => (
            <li key={project.id} className="flex items-center gap-3 px-4 py-3 text-xs">
              <span className="text-base opacity-60">{project.icon || '⚡'}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-content-secondary">{project.name} <span className="font-mono text-content-muted">#{project.key}</span></p>
                <p className="text-[11px] text-content-muted">
                  Archived {project.archivedAt ? new Date(project.archivedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  {project.archivedBy ? ` by ${project.archivedBy}` : ''}
                </p>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" disabled={restoring === project.id}
                    onClick={async () => { setRestoring(project.id); await onRestore(project); setRestoring(null); }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-link hover:bg-surface-high hover:text-link-hover disabled:opacity-50">
                    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />{restoring === project.id ? 'Restoring…' : 'Restore'}
                  </button>
                  <button type="button" onClick={() => onDelete(project)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-status-danger hover:bg-surface-high">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
