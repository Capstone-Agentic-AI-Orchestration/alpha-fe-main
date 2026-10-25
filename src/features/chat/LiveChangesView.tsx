import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, LoaderCircle, RefreshCw } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { LiveBuildChanges } from '@/shared/types';

type FileChange = LiveBuildChanges['repositories'][number]['files'][number];

/** Split one unified diff into its per-file sections, keyed by the file's path. */
export function splitDiffByFile(diff: string): Map<string, string> {
  const sections = new Map<string, string>();
  for (const chunk of diff.split(/^(?=diff --git )/m)) {
    const match = /^diff --git a\/(.+?) b\/(.+)$/m.exec(chunk);
    if (match) sections.set(match[2], chunk);
  }
  return sections;
}

/** A unified diff, coloured by line. */
export const DiffLines: React.FC<{ diff: string; label: string }> = ({ diff, label }) => (
  <div aria-label={label} className="overflow-auto bg-code text-code-content py-2 font-mono text-[10.5px] leading-[1.65]">
    {diff.split('\n').filter(line => !/^(diff --git|index |new file mode|deleted file mode|--- |\+\+\+ )/.test(line)).map((line, index) =>
      <div key={index} className={'min-w-max whitespace-pre px-3 ' + (line.startsWith('+') ? 'bg-diff-added text-diff-added-content' : line.startsWith('-') ? 'bg-diff-removed text-diff-removed-content' : line.startsWith('@@') ? 'text-diff-hunk' : 'text-content-secondary')}>{line || ' '}</div>)}
  </div>
);

const STATUS_TONE: Record<FileChange['status'], string> = { added: 'text-status-success', modified: 'text-status-warning', deleted: 'text-status-danger' };
const STATUS_LETTER: Record<FileChange['status'], string> = { added: 'A', modified: 'M', deleted: 'D' };

/**
 * The code a build has changed so far, read live from its worktrees. While an agent is
 * working it refreshes every few seconds, so edits appear as the agent writes them.
 */
export const LiveChangesView: React.FC<{
  projectId: string;
  runId: string;
  live: boolean;
  /** Only this codebase. */
  repository?: string;
  /** Only these files, when the changes belong to one agent. */
  paths?: string[];
  /** The file the agent touched most recently, opened first. */
  focusPath?: string;
  emptyText?: string;
}> = ({ projectId, runId, live, repository, paths, focusPath, emptyText }) => {
  const [changes, setChanges] = useState<LiveBuildChanges | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      setLoading(true);
      try {
        const next = await apiService.getOrchestrationLiveChanges(projectId, runId);
        if (!cancelled) { setChanges(next); setError(null); }
      } catch (caught: any) {
        if (!cancelled) setError(caught?.message ?? 'The changes could not be read.');
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (live) timer = window.setTimeout(() => void load(), 3000);
        }
      }
    };
    void load();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [projectId, runId, live]);

  const filter = useMemo(() => paths?.length ? new Set(paths) : null, [paths]);
  const groups = useMemo(() => (changes?.repositories ?? [])
    .filter(item => !repository || item.repository.toLowerCase() === repository.toLowerCase())
    .map(item => {
      const sections = splitDiffByFile(item.diff);
      const files = item.files.filter(file => !filter || filter.has(file.path));
      return { ...item, files, sections };
    }), [changes, repository, filter]);
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);

  // Open the file being edited, until the person opens or closes files themselves.
  useEffect(() => {
    if (touched) return;
    const first = focusPath && groups.some(group => group.files.some(file => file.path === focusPath)) ? focusPath : groups[0]?.files[0]?.path;
    if (first) setOpen(new Set([first]));
  }, [focusPath, groups, touched]);

  const toggle = (file: string) => {
    setTouched(true);
    setOpen(current => { const next = new Set(current); if (next.has(file)) next.delete(file); else next.add(file); return next; });
  };

  if (!changes && loading) return <p role="status" className="flex items-center gap-2 text-xs text-content-muted"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Reading the changes…</p>;
  if (error && !changes) return <p role="alert" className="text-xs text-status-danger">{error}</p>;

  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2 text-[10px] text-content-muted">
      <span>{total} {total === 1 ? 'file' : 'files'} changed{groups.length ? ' · ' + groups.reduce((sum, group) => sum + group.files.reduce((s, file) => s + file.additions, 0), 0) + ' added, ' + groups.reduce((sum, group) => sum + group.files.reduce((s, file) => s + file.deletions, 0), 0) + ' removed' : ''}</span>
      <span className="flex items-center gap-1.5">{live ? <><span className="h-1.5 w-1.5 rounded-full bg-violet-300 motion-safe:animate-pulse" />Live</> : loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}</span>
    </div>
    {!total && <p className="flex items-center gap-2 text-xs text-content-muted"><FileCode2 className="h-3.5 w-3.5 text-link" />{emptyText ?? (live ? 'No file changes yet. Edits appear here as the agent writes them.' : 'No file changes.')}</p>}
    {groups.filter(group => group.files.length).map(group => <section key={group.repository} className="space-y-1.5">
      {groups.length > 1 && <h4 className="truncate text-[10px] font-semibold text-content-secondary">{group.repository}</h4>}
      {group.files.map(file => {
        const expanded = open.has(file.path);
        const section = group.sections.get(file.path);
        return <div key={file.path} className="overflow-hidden rounded-lg border border-divider">
          <button type="button" onClick={() => toggle(file.path)} aria-expanded={expanded} className="flex w-full items-center gap-2 bg-surface-raised px-2.5 py-1.5 text-left hover:bg-surface-high">
            {expanded ? <ChevronDown className="h-3 w-3 shrink-0 text-content-muted" /> : <ChevronRight className="h-3 w-3 shrink-0 text-content-muted" />}
            <span className={'w-3 shrink-0 text-[10px] font-semibold ' + STATUS_TONE[file.status]}>{STATUS_LETTER[file.status]}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-content" title={file.path}>{file.path}</span>
            {file.path === focusPath && live && <span className="shrink-0 rounded bg-selected px-1.5 text-[9px] text-selected-content">editing</span>}
            <span className="shrink-0 font-mono text-[10px] text-status-success">+{file.additions}</span>
            <span className="shrink-0 font-mono text-[10px] text-status-danger">−{file.deletions}</span>
          </button>
          {expanded && (section ? <DiffLines diff={section} label={'Changes in ' + file.path} /> : <p className="px-3 py-2 text-[11px] text-content-muted">The diff for this file is not available in this preview.</p>)}
        </div>;
      })}
      {(group.truncated || group.filesTruncated) && <p className="text-[10px] text-status-warning">Some changes are not shown here. Use the repository for the full diff. The in-chat preview reached its display limit.</p>}
    </section>)}
  </div>;
};

