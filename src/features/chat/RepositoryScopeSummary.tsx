import { FolderGit2 } from 'lucide-react';

/**
 * The composer's repository picker is an optional limit, not a visibility
 * switch: agents always see every project repository. Ticking all of them (the
 * default) means no limit; a deliberately ticked subset limits builds and
 * handoffs to those repositories.
 */
export type RepositoryScope =
  | { kind: 'all'; label: string; hint: string }
  | { kind: 'limited'; label: string; hint: string; repositories: string[] }
  | { kind: 'none'; label: string; hint: string };

const shortRepo = (repository: string) => repository.split('/').pop() || repository;

/** `selected` should already be filtered to repositories the project still has. */
export function repositoryScope(projectRepositories: readonly string[], selected: readonly string[]): RepositoryScope {
  const ticked = projectRepositories.filter(repo => selected.includes(repo));
  if (ticked.length === 0) {
    return { kind: 'none', label: 'No repositories ticked', hint: 'Tick at least one repository to build.' };
  }
  if (ticked.length === projectRepositories.length) {
    return { kind: 'all', label: 'All repositories', hint: 'Agents always see every repository; untick to limit builds.' };
  }
  return {
    kind: 'limited',
    label: `Limited to ${ticked.map(shortRepo).join(', ')}`,
    hint: 'Builds and handoffs stay in the ticked repositories. Choose All to lift the limit.',
    repositories: ticked,
  };
}

const LABEL_TONE: Record<RepositoryScope['kind'], string> = {
  all: 'text-content',
  limited: 'text-status-info',
  none: 'text-status-warning',
};

export function RepositoryScopeSummary({ scope }: { scope: RepositoryScope }) {
  const labelTone = LABEL_TONE[scope.kind];
  return <span className="flex min-w-0 flex-1 flex-col gap-0.5" data-repository-scope={scope.kind}>
    <span className={`flex min-w-0 items-center gap-2 text-[11px] font-semibold ${labelTone}`}>
      <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-link" />
      <span className="truncate" title={scope.label}>{scope.label}</span>
    </span>
    <span className="text-[10px] font-normal text-content-muted">{scope.hint}</span>
  </span>;
}
