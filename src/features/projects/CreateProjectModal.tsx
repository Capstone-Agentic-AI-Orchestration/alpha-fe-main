import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { ProjectResourcesPanel } from './ProjectResourcesPanel';
import { deriveProjectKey } from './useProjectsViewModel';
import { normalizeProjectRepositoryUrl } from './projectRepositoryUrl';
import { Project, ProjectPriority, ProjectResource } from '@/shared/types';
import { AlertCircle, ChevronDown, FolderOpen, GitBranch, Loader2, Plus, Sparkles, Trash2, Workflow } from 'lucide-react';
import { aiFeaturesEnabled } from '@/config/features';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}

const ICONS = ['⚡', '🎨', '🚀', '🛡️', '💳', '🧠', '📦', '🌐', '⚙️', '🎯', '📱', '🔒'];
const inputClass = 'w-full min-w-0 rounded-xl border border-control bg-surface px-3.5 py-2.5 text-sm text-content placeholder-content-muted outline-none transition-colors focus:border-control';

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { createProject, updateProject, projects, can, role } = useApp();
  // Orchestrator, planning and repository setup are AI tooling, hidden for roles without it (config/features.ts).
  const showBuildSetup = aiFeaturesEnabled(role);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [setupRepository, setSetupRepository] = useState(true);
  const [repositoryProvisioning, setRepositoryProvisioning] = useState(false);
  const formId = useId();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [targetDate, setTargetDate] = useState('');
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [showIcons, setShowIcons] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const key = useMemo(() => deriveProjectKey(name, projects), [name, projects]);

  useEffect(() => {
    if (!isOpen) return;
    setCreatedProject(null); setSetupRepository(true); setRepositoryProvisioning(false);
    setName(''); setIcon('⚡'); setDescription(''); setPriority('medium');
    setTargetDate(''); setResources([]); setRepoUrl(''); setError(null); setRepoError(null); setShowIcons(false);
  }, [isOpen]);

  const pendingRepository = (): ProjectResource | null => {
    if (!repoUrl.trim()) return null;
    let url: string;
    try { url = normalizeProjectRepositoryUrl(repoUrl); }
    catch { throw new Error('Use a repository URL like https://github.com/owner/repository.'); }
    if (resources.some(resource => resource.type === 'github_repo' && resource.pathOrUrl.toLowerCase() === url.toLowerCase())) throw new Error('This repository is already attached.');
    return { id: `res-${crypto.randomUUID()}`, type: 'github_repo', name: url.split('/').at(-1)!, pathOrUrl: url };
  };

  const addRepository = () => {
    try {
      const resource = pendingRepository();
      if (resource) setResources(previous => [...previous, resource]);
      setRepoUrl(''); setRepoError(null);
    } catch (err) { setRepoError((err as Error).message); }
  };

  const addFolder = (path: string) => {
    if (resources.some(resource => resource.pathOrUrl === path)) return;
    setResources(previous => [...previous, { id: `res-${crypto.randomUUID()}`, type: 'local_dir', name: path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || 'Local folder', pathOrUrl: path, branchOrMachine: 'Local machine' }]);
  };
  const chooseFolder = async () => {
    try {
      const api = (window as any).alphaAPI;
      if (api?.selectFolder) { const path = await api.selectFolder(); if (path) addFolder(path); }
      else folderRef.current?.click();
    } catch { setError('Could not open the folder picker. Please try again.'); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || !name.trim()) return;
    let pending: ProjectResource | null;
    try { pending = pendingRepository(); }
    catch (err) { setRepoError((err as Error).message); return; }
    submittingRef.current = true; setSubmitting(true); setError(null); setRepoError(null);
    try {
      const project = await createProject({ name: name.trim(), key, description: description.trim(), icon, color: '#6366f1', status: 'planned', priority, targetDate,
        leadType: 'agent', leadName: 'Orchestrator', resources: pending ? [...resources, pending] : resources });
      if (setupRepository && showBuildSetup) setCreatedProject(project);
      else { onCreated?.(project); onClose(); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the project. Please try again.'); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };

  // Save the project before provisioning so a failed or abandoned setup remains recoverable.
  if (createdProject) {
    // Keep the setup panel bound to AppContext's canonical optimistic project.
    // If persistence fails, AppContext rolls that project back and the panel
    // reflects the rollback instead of retaining an unattached resource.
    const setupProject = projects.find(project => project.id === createdProject.id) ?? createdProject;
    const finish = () => { onCreated?.(setupProject); onClose(); };
    const saveSetup = (updates: Partial<Project>) => updateProject(setupProject.id, updates);
    return <Modal isOpen={isOpen} onClose={() => { if (!repositoryProvisioning) finish(); }} title="Set up project repositories" subtitle={`${createdProject.name} is saved. Create a GitHub repository or connect existing code.`} maxWidth="max-w-3xl"
      footer={<button type="button" onClick={finish} disabled={repositoryProvisioning} className="rounded-xl bg-action px-5 py-2.5 text-sm font-semibold text-on-action hover:bg-action-hover disabled:cursor-wait disabled:opacity-50">{repositoryProvisioning ? 'Creating repository…' : 'Open project'}</button>}>
      <ProjectResourcesPanel projectId={setupProject.id} resources={setupProject.resources ?? []}
        onChange={resources => saveSetup({ resources })} githubOrg={setupProject.githubOrg}
        onOrgChange={githubOrg => saveSetup({ githubOrg })} canCreateRepository={can('provision_repositories')}
        onProvisioningChange={setRepositoryProvisioning} />
    </Modal>;
  }

  return <Modal isOpen={isOpen} onClose={() => { if (!submittingRef.current) onClose(); }} title="New project" subtitle={showBuildSetup ? 'Set the direction and connect the code. The Orchestrator leads every build.' : 'Name the project and describe what it is for.'} maxWidth="max-w-3xl"
    footer={<div className="flex items-center justify-between gap-4">{showBuildSetup && <span className="hidden text-[11px] text-content-muted sm:block">You can refine the project after creating it.</span>}<div className="ml-auto flex items-center gap-2"><button type="button" onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-high hover:text-content disabled:opacity-50">Cancel</button><button type="submit" form={formId} disabled={submitting || !name.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-action px-5 py-2.5 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? 'Creating project…' : 'Create project'}</button></div></div>}>
    <form id={formId} onSubmit={submit} className="space-y-6">
      <fieldset disabled={submitting} className="space-y-6 min-w-0">
        <div className="space-y-2">
          <label htmlFor={`${formId}-name`} className="block text-xs font-medium text-content-secondary">Project name <span className="text-link">*</span></label>
          <div className="flex items-start gap-3">
            <div className="relative shrink-0"><button type="button" onClick={() => setShowIcons(!showIcons)} aria-label="Choose project icon" aria-expanded={showIcons} className="flex h-11 items-center gap-1 rounded-xl border border-divider bg-surface px-3 text-xl hover:border-divider">{icon}<ChevronDown className="h-3 w-3 text-content-muted" /></button>
              {showIcons && <div className="absolute left-0 top-full z-20 mt-2 grid w-48 grid-cols-4 gap-1 rounded-xl border border-divider bg-surface-raised p-2 shadow-xl">{ICONS.map(item => <button key={item} type="button" aria-label={`Use ${item} icon`} onClick={() => { setIcon(item); setShowIcons(false); }} className="rounded-lg p-2 hover:bg-surface-high">{item}</button>)}</div>}
            </div>
            <div className="relative min-w-0 flex-1"><input id={`${formId}-name`} autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Customer portal" className={`${inputClass} pr-20`} />{name.trim() && <span className="pointer-events-none absolute right-3 top-3 font-mono text-xs text-content-muted" title="Task prefix">{key}</span>}</div>
          </div>
        </div>
        <div className="space-y-2"><label htmlFor={`${formId}-description`} className="block text-xs font-medium text-content-secondary">Goal & ground rules <span className="ml-1 font-normal text-content-muted">Optional</span></label><textarea id={`${formId}-description`} rows={3} maxLength={8000} value={description} onChange={event => setDescription(event.target.value)} placeholder="What are we building? Include the stack, constraints, and what success looks like." className={`${inputClass} resize-y leading-relaxed`} /><div className="flex items-center justify-between gap-3">{showBuildSetup ? <p className="text-[11px] text-content-muted">Shared with agents as context for every Orchestrator build.</p> : <span />}<span className="shrink-0 text-[10px] text-content-muted">{description.length.toLocaleString()} / 8,000</span></div></div>
        {showBuildSetup && <>
        <div className="flex items-start gap-3 rounded-xl border border-divider bg-selected p-3.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-divider bg-selected text-selected-content"><Workflow className="h-4 w-4" /></div><div><div className="flex items-center gap-1.5 text-xs font-semibold text-link"><Sparkles className="h-3.5 w-3.5" />Build lead: Orchestrator</div><p className="mt-1 text-[11px] leading-5 text-content-secondary">No team setup is needed. For each build, the Orchestrator shows its plan and specialist assignments for you to review before work starts.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor={`${formId}-priority`} className="text-xs font-medium text-content-secondary">Priority</label><select id={`${formId}-priority`} value={priority} onChange={event => setPriority(event.target.value as ProjectPriority)} className={inputClass}><option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div><div className="space-y-2"><label htmlFor={`${formId}-date`} className="text-xs font-medium text-content-secondary">Target date <span className="ml-1 font-normal text-content-muted">Optional</span></label><input id={`${formId}-date`} type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} className={`${inputClass} [color-scheme:dark]`} /></div></div>
        </>}
        {showBuildSetup && <section className="space-y-3 border-t border-divider pt-5" aria-label="Project repositories">
          <label className="flex items-start gap-3 text-sm text-content"><input type="checkbox" checked={setupRepository} onChange={event => setSetupRepository(event.target.checked)} className="mt-1 accent-brand-500" /><span>Set up repositories next<span className="mt-1 block text-xs text-content-muted">Create a GitHub repository or connect existing code after saving this project.</span></span></label>
          <div className="space-y-2"><label htmlFor={`${formId}-repo`} className="text-xs font-medium text-content-secondary">Repository URL <span className="ml-1 font-normal text-content-muted">Optional</span></label><div className="flex gap-2"><div className="relative min-w-0 flex-1"><GitBranch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-content-muted" /><input id={`${formId}-repo`} value={repoUrl} onChange={event => { setRepoUrl(event.target.value); setRepoError(null); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRepository(); } }} placeholder="https://github.com/owner/repository" aria-invalid={!!repoError} aria-describedby={repoError ? `${formId}-repo-error` : `${formId}-repo-hint`} className={`${inputClass} pl-9`} /></div><button type="button" onClick={addRepository} disabled={!repoUrl.trim()} aria-label="Attach repository and add another" title="Attach repository and add another" className="rounded-xl border border-divider px-3 text-content-secondary hover:bg-surface-high disabled:opacity-30"><Plus className="h-4 w-4" /></button></div>
          {repoError ? <p id={`${formId}-repo-error`} role="alert" className="text-xs text-status-danger">{repoError}</p> : <p id={`${formId}-repo-hint`} className="text-[11px] text-content-muted">Saved when you create the project. Use + to attach more than one.</p>}</div>
          {resources.map(resource => <div key={resource.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2 text-xs"><span className="min-w-0 truncate text-content-secondary" title={resource.pathOrUrl}>{resource.pathOrUrl}</span><button type="button" onClick={() => setResources(previous => previous.filter(item => item.id !== resource.id))} aria-label={`Remove ${resource.name}`} className="shrink-0 rounded p-1 text-content-muted hover:text-status-danger"><Trash2 className="h-3.5 w-3.5" /></button></div>)}
          <button type="button" onClick={chooseFolder} className="inline-flex items-center gap-2 text-xs text-content-secondary transition-colors hover:text-content"><FolderOpen className="h-3.5 w-3.5" />Attach a local folder</button>
          {resources.some(resource => resource.type === 'local_dir') && <p className="text-[11px] text-status-warning">Local folders are available only on this machine.</p>}
          <input ref={folderRef} type="file" className="hidden" {...{ webkitdirectory: '', directory: '' } as any} onChange={event => { const file = event.target.files?.[0] as (File & { path?: string }) | undefined; if (file) addFolder(file.path || file.webkitRelativePath.split('/')[0]); event.target.value = ''; }} />
        </section>}
      </fieldset>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-status-danger-border bg-status-danger-subtle p-3 text-xs leading-relaxed text-status-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    </form>
  </Modal>;
};
