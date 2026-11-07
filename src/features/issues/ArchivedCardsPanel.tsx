import React, { useEffect, useState } from 'react';
import { Archive, RotateCcw, Trash2, X } from 'lucide-react';
import { apiService } from '@/shared/services/apiService';
import type { Issue } from '@/shared/types';

/** One archived task, with restore and a two-step permanent delete. */
export const ArchivedCardsList: React.FC<{
  issues: Issue[];
  canManageIssues: boolean;
  confirmingDeleteId?: string | null;
  busyId?: string | null;
  onRestore: (issue: Issue) => void;
  onAskDelete: (issueId: string | null) => void;
  onDelete: (issue: Issue) => void;
}> = ({ issues, canManageIssues, confirmingDeleteId, busyId, onRestore, onAskDelete, onDelete }) => {
  if (!issues.length) return <p className="px-4 py-6 text-xs text-content-muted">No archived tasks in this project.</p>;
  return (
    <ul className="divide-y divide-divider">
      {issues.map(issue => (
        <li key={issue.id} className="px-4 py-3 space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-content-secondary">{issue.identifier}</span>
            <span className="truncate text-content">{issue.title}</span>
          </div>
          <div className="text-[11px] text-content-muted">
            Archived{issue.archivedBy ? ` by ${issue.archivedBy}` : ''}{issue.archivedAt ? ` on ${new Date(issue.archivedAt).toLocaleDateString()}` : ''}
          </div>
          {canManageIssues && (
            confirmingDeleteId === issue.id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-status-danger-border bg-status-danger-subtle px-2 py-1.5">
                <span className="text-status-danger">Delete permanently, with its comments and history? This cannot be undone.</span>
                <button type="button" disabled={busyId === issue.id} onClick={() => onDelete(issue)} className="font-semibold text-status-danger hover:underline disabled:opacity-50">Delete permanently</button>
                <button type="button" onClick={() => onAskDelete(null)} className="text-content-secondary hover:text-content">Keep</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button type="button" disabled={busyId === issue.id} onClick={() => onRestore(issue)} className="inline-flex items-center gap-1 font-medium text-selected-content hover:underline disabled:opacity-50">
                  <RotateCcw className="h-3 w-3" aria-hidden="true" /> Restore
                </button>
                <button type="button" onClick={() => onAskDelete(issue.id)} className="inline-flex items-center gap-1 text-content-secondary hover:text-status-danger">
                  <Trash2 className="h-3 w-3" aria-hidden="true" /> Delete permanently
                </button>
              </div>
            )
          )}
        </li>
      ))}
    </ul>
  );
};

/**
 * Archived tasks for one project. Loaded only when opened, so board loads
 * never carry them. Permanent delete lives here and is for people only.
 */
export const ArchivedCardsPanel: React.FC<{
  projectId: string | 'all';
  canManageIssues: boolean;
  onRestore: (issue: Issue) => Promise<boolean>;
  onClose: () => void;
}> = ({ projectId, canManageIssues, onRestore, onClose }) => {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiService.getArchivedIssues()
      .then(rows => { if (!cancelled) setIssues(rows.filter(issue => projectId === 'all' || issue.projectId === projectId)); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [projectId]);

  const restore = async (issue: Issue) => {
    setBusyId(issue.id);
    if (await onRestore(issue)) setIssues(prev => (prev ?? []).filter(item => item.id !== issue.id));
    setBusyId(null);
  };

  const remove = async (issue: Issue) => {
    setBusyId(issue.id);
    try {
      await apiService.deleteIssue(issue.id);
      setIssues(prev => (prev ?? []).filter(item => item.id !== issue.id));
      setConfirmingDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside aria-label="Archived tasks" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-divider bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
        <Archive className="h-4 w-4 text-content-secondary" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-content">Archived</h2>
        <button type="button" onClick={onClose} aria-label="Close archived tasks" className="ml-auto rounded-md p-1 text-content-muted hover:bg-surface-high hover:text-content">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error && <p className="px-4 py-2 text-xs text-status-danger">{error}</p>}
        {issues === null && !error
          ? <p className="px-4 py-6 text-xs text-content-muted">Loading archived tasks…</p>
          : issues && (
            <ArchivedCardsList
              issues={issues}
              canManageIssues={canManageIssues}
              confirmingDeleteId={confirmingDeleteId}
              busyId={busyId}
              onRestore={issue => void restore(issue)}
              onAskDelete={setConfirmingDeleteId}
              onDelete={issue => void remove(issue)}
            />
          )}
      </div>
    </aside>
  );
};

