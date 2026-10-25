import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import {
  isHandoffIssueCandidate, loadPmHandoffOptions, validHandoffSelection,
  type PmHandoffOptions,
} from './pmWorkHandoff';
import { primary, secondary } from './ticketUi';

export interface PmWorkHandoffDraft { projectId: string; issueIds: string[] }

export function PmWorkHandoffForm({ disabled, linkedProjectId = null, linkedProjectName = null, onCancel, onSubmit }: {
  disabled: boolean;
  linkedProjectId?: string | null;
  linkedProjectName?: string | null;
  onCancel: () => void;
  onSubmit: (draft: PmWorkHandoffDraft) => void;
}) {
  const [options, setOptions] = useState<PmHandoffOptions | null>(null);
  const [projectId, setProjectId] = useState('');
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true); setFailed(false); setOptions(null);
    setProjectId(linkedProjectId ?? ''); setIssueIds([]); setConfirmed(false);
    loadPmHandoffOptions().then(value => { if (current) {
      setOptions(value);
      setProjectId(linkedProjectId ?? '');
    } })
      .catch(() => { if (current) setFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [refresh, linkedProjectId]);

  const project = options?.projects.find(item => item.id === projectId);
  const availableProjects = linkedProjectId
    ? options?.projects.filter(item => item.id === linkedProjectId) ?? []
    : options?.projects ?? [];
  const issues = options?.issues.filter(issue => isHandoffIssueCandidate(issue, projectId)) ?? [];
  const ready = !disabled && !loading && confirmed && options !== null
    && validHandoffSelection(options, projectId, issueIds);

  return <form aria-label="Authorize ticket work" className="space-y-4 rounded-xl border border-divider bg-selected p-4"
    onSubmit={event => { event.preventDefault(); if (ready) onSubmit({ projectId, issueIds: [...issueIds] }); }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium text-content">Link agreed work</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-content-muted">Select an existing project and its tasks. Create any missing work through the existing Projects and Tasks pages, then refresh this list.</p>
      </div>
      <button type="button" className={secondary} disabled={disabled || loading} onClick={() => setRefresh(value => value + 1)} aria-label="Refresh project and task choices"><RefreshCw size={13} /></button>
    </div>
    {loading && <p role="status" className="text-xs text-content-muted">Loading workspace projects and tasks…</p>}
    {failed && <p role="alert" className="rounded-md border border-status-danger-border bg-status-danger-subtle p-2.5 text-xs text-status-danger">Could not load project and task choices. Refresh to try again.</p>}
    {options && <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="sr-only">Project and task selection</legend>
      <div>
        <span className="text-[11px] font-medium text-content-secondary">Project</span>
        <details className="group relative mt-1.5 rounded-lg border border-divider bg-surface">
          <summary aria-label="Choose a project" className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-content-secondary ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
            <span className="truncate">{project ? `${project.key} · ${project.name}` : 'Choose a project'}</span><ChevronDown size={13} className="shrink-0 text-content-muted" />
          </summary>
          <div className="max-h-48 overflow-y-auto border-t border-divider p-1">
            {availableProjects.length === 0 && <p className="p-2 text-xs text-content-muted">{linkedProjectId ? 'The linked project is not available in this workspace project list.' : 'No projects are available in this workspace.'}</p>}
            {availableProjects.map(item => <button type="button" key={item.id} aria-pressed={projectId === item.id}
              disabled={Boolean(linkedProjectId)}
              className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-content-secondary hover:bg-selected aria-pressed:bg-selected aria-pressed:text-link"
              onClick={event => {
                setProjectId(item.id); setIssueIds([]); setConfirmed(false);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}>{item.key} · {item.name}</button>)}
          </div>
        </details>
      </div>
      {linkedProjectId && <p className="text-[10px] text-content-muted">This request is already organized under {project?.name ?? linkedProjectName ?? 'its linked project'}. Authorized work must stay in that project.</p>}
      {project && <div>
        <p className="text-[11px] font-medium text-content-secondary">Tasks to include</p>
        <p className="mt-1 text-[10px] leading-relaxed text-content-muted">Backlog or Todo tasks can be selected without an assigned developer. The server checks project access, existing ticket links and active runs before saving.</p>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-divider p-2">
          {issues.length === 0 && <p className="p-2 text-xs text-content-muted">No eligible tasks in this project. Create an unstarted task, then refresh.</p>}
          {issues.map(issue => <label key={issue.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-surface-high">
            <input type="checkbox" className="mt-0.5 accent-brand-500" checked={issueIds.includes(issue.id)} onChange={event => {
              setIssueIds(current => event.target.checked ? [...current, issue.id] : current.filter(id => id !== issue.id)); setConfirmed(false);
            }} />
            <span className="min-w-0 text-xs text-content-secondary"><span className="text-[10px] text-content-muted">{issue.identifier}</span> {issue.title}
              <span className="mt-1 block text-[10px] text-content-muted">{issue.status === 'todo' ? 'Todo' : 'Backlog'}{issue.assignedHuman?.trim() ? ` · ${issue.assignedHuman}` : ''}</span>
            </span>
          </label>)}
        </div>
      </div>}
      {issueIds.length > 0 && <label className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-subtle p-3 text-[11px] leading-relaxed text-status-warning">
        <input type="checkbox" className="mt-0.5 accent-brand-500" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        The selected {issueIds.length} task{issueIds.length === 1 ? ' covers' : 's cover'} the client's agreed scope. Authorization locks this work manifest; it does not start agents or share internal project access.
      </label>}
    </fieldset>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-3">
      <button type="button" disabled={disabled} onClick={onCancel} className={secondary}>Cancel</button>
      <button type="submit" disabled={!ready} className={primary}>Authorize agreed work</button>
    </div>
  </form>;
}
