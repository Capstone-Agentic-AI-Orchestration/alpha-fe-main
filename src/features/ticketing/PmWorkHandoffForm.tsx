import { useEffect, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import {
  isHandoffIssueCandidate, loadPmHandoffOptions, validHandoffSelection,
  type PmHandoffOptions,
} from './pmWorkHandoff';
import { primary, secondary } from './ticketUi';

export interface PmWorkHandoffDraft { projectId: string; issueIds: string[] }

export function PmWorkHandoffForm({ disabled, onCancel, onSubmit }: {
  disabled: boolean;
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
    setProjectId(''); setIssueIds([]); setConfirmed(false);
    loadPmHandoffOptions().then(value => { if (current) setOptions(value); })
      .catch(() => { if (current) setFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [refresh]);

  const project = options?.projects.find(item => item.id === projectId);
  const issues = options?.issues.filter(issue => isHandoffIssueCandidate(issue, projectId)) ?? [];
  const ready = !disabled && !loading && confirmed && options !== null
    && validHandoffSelection(options, projectId, issueIds);

  return <form aria-label="Authorize ticket work" className="space-y-4 rounded-xl border border-brand-400/15 bg-brand-500/[0.035] p-4"
    onSubmit={event => { event.preventDefault(); if (ready) onSubmit({ projectId, issueIds: [...issueIds] }); }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium text-gray-100">Link agreed work</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Select an existing project and its assigned Issues. Create any missing work through the existing Projects and Issues pages, then refresh this list.</p>
      </div>
      <button type="button" className={secondary} disabled={disabled || loading} onClick={() => setRefresh(value => value + 1)} aria-label="Refresh project and Issue choices"><RefreshCw size={13} /></button>
    </div>
    {loading && <p role="status" className="text-xs text-gray-500">Loading workspace projects and Issues…</p>}
    {failed && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-xs text-rose-200">Could not load project and Issue choices. Refresh to try again.</p>}
    {options && <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="sr-only">Project and Issue selection</legend>
      <div>
        <span className="text-[11px] font-medium text-gray-300">Project</span>
        <details className="group relative mt-1.5 rounded-lg border border-white/[0.08] bg-surface">
          <summary aria-label="Choose a project" className={`flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs text-gray-300 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
            <span className="truncate">{project ? `${project.key} · ${project.name}` : 'Choose a project'}</span><ChevronDown size={13} className="shrink-0 text-gray-500" />
          </summary>
          <div className="max-h-48 overflow-y-auto border-t border-white/[0.07] p-1">
            {options.projects.length === 0 && <p className="p-2 text-xs text-gray-500">No projects are available in this workspace.</p>}
            {options.projects.map(item => <button type="button" key={item.id} aria-pressed={projectId === item.id}
              className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-gray-300 hover:bg-brand-500/10 aria-pressed:bg-brand-500/15 aria-pressed:text-brand-200"
              onClick={event => {
                setProjectId(item.id); setIssueIds([]); setConfirmed(false);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}>{item.key} · {item.name}</button>)}
          </div>
        </details>
      </div>
      {project && <div>
        <p className="text-[11px] font-medium text-gray-300">Issues to include</p>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Only Backlog or Todo Issues with a human assignee appear. The server checks current developer access, existing ticket links and active runs before saving.</p>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[0.07] p-2">
          {issues.length === 0 && <p className="p-2 text-xs text-gray-500">No eligible Issues in this project. Create or assign an unstarted Issue, then refresh.</p>}
          {issues.map(issue => <label key={issue.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-white/[0.035]">
            <input type="checkbox" className="mt-0.5 accent-brand-500" checked={issueIds.includes(issue.id)} onChange={event => {
              setIssueIds(current => event.target.checked ? [...current, issue.id] : current.filter(id => id !== issue.id)); setConfirmed(false);
            }} />
            <span className="min-w-0 text-xs text-gray-300"><span className="text-[10px] text-gray-500">{issue.identifier}</span> {issue.title}
              <span className="mt-1 block text-[10px] text-gray-500">{issue.status === 'todo' ? 'Todo' : 'Backlog'} · {issue.assignedHuman}</span>
            </span>
          </label>)}
        </div>
      </div>}
      {issueIds.length > 0 && <label className="flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.04] p-3 text-[11px] leading-relaxed text-amber-100/80">
        <input type="checkbox" className="mt-0.5 accent-brand-500" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        The selected {issueIds.length} Issue{issueIds.length === 1 ? ' covers' : 's cover'} the client's agreed scope. Authorization locks this work manifest; it does not start agents or share internal project access.
      </label>}
    </fieldset>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-3">
      <button type="button" disabled={disabled} onClick={onCancel} className={secondary}>Cancel</button>
      <button type="submit" disabled={!ready} className={primary}>Authorize agreed work</button>
    </div>
  </form>;
}
