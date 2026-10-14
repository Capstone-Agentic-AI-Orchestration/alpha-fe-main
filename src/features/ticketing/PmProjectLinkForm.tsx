import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import type { Project } from '@/shared/types';
import { input, primary, secondary } from './ticketUi';

export interface PmProjectLinkDraft { projectId: string | null; clientVisible: boolean }

export function PmProjectLinkForm({ initialProjectId, initialClientVisible, projectLocked, disabled, onCancel, onSubmit }: {
  initialProjectId: string | null;
  initialClientVisible: boolean;
  projectLocked: boolean;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (draft: PmProjectLinkDraft) => void;
}) {
  const [projects, setProjects] = useState<Array<Pick<Project, 'id' | 'key' | 'name'>>>([]);
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [clientVisible, setClientVisible] = useState(initialClientVisible);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true); setFailed(false);
    apiService.getProjects().then(value => {
      if (current) setProjects(value.map(project => ({ id: project.id, key: project.key, name: project.name })));
    }).catch(() => { if (current) setFailed(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [refresh]);

  useEffect(() => {
    setProjectId(initialProjectId ?? '');
    setClientVisible(initialClientVisible);
  }, [initialProjectId, initialClientVisible]);

  const selected = projects.find(project => project.id === projectId);
  const currentMissing = Boolean(initialProjectId && !projects.some(project => project.id === initialProjectId));
  const valid = projectId === '' || projects.some(project => project.id === projectId);
  return <form aria-label="Link request to project" className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
    onSubmit={event => { event.preventDefault(); if (!disabled && valid) onSubmit({ projectId: projectId || null, clientVisible: Boolean(projectId) && clientVisible }); }}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-medium text-gray-100">Organize this request</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Link it to a project to keep this client’s requests together. This does not expose the project or its Issues to the client.</p>
      </div>
      <button type="button" className={secondary} disabled={disabled || loading} onClick={() => setRefresh(value => value + 1)} aria-label="Refresh workspace projects"><RefreshCw size={13} /></button>
    </div>
    {loading && <p role="status" className="text-xs text-gray-500">Loading projects from this workspace…</p>}
    {failed && <p role="alert" className="rounded-md border border-rose-400/20 bg-rose-500/[0.06] p-2.5 text-xs text-rose-200">Could not load workspace projects. Refresh to try again.</p>}
    {currentMissing && <p role="status" className="rounded-md border border-amber-400/15 bg-amber-500/[0.04] p-2.5 text-xs text-amber-100/80">The linked project is not in the current project list. Refresh or choose another project if this request has no authorized work.</p>}
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-gray-300">Project</span>
      <select aria-label="Project" className={input} value={projectId} disabled={disabled || loading || projectLocked} onChange={event => setProjectId(event.target.value)}>
        <option value="">Not linked to a project</option>
        {currentMissing && initialProjectId && <option value={initialProjectId}>Existing project link (unavailable)</option>}
        {projects.map(project => <option key={project.id} value={project.id}>{project.key} · {project.name}</option>)}
      </select>
      {projectLocked && <span className="block text-[10px] text-gray-500">This request already has authorized work. Its project cannot be changed.</span>}
      {selected && <span className="block text-[10px] text-gray-500">{selected.name} · workspace project</span>}
    </label>
    <label className={`flex items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-[11px] leading-relaxed ${projectId ? 'text-gray-300' : 'text-gray-600'}`}>
      <input type="checkbox" className="mt-0.5 accent-brand-500" checked={clientVisible} disabled={disabled || !projectId}
        onChange={event => setClientVisible(event.target.checked)} />
      Show only the project name as a limited preview in this client’s portal. This never grants access to Issues, project files, or other requests.
    </label>
    <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] pt-3">
      <button type="button" disabled={disabled} onClick={onCancel} className={secondary}>Cancel</button>
      <button type="submit" disabled={disabled || loading || failed || !valid} className={primary}>Save project link</button>
    </div>
  </form>;
}
