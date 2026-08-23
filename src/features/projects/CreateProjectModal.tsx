import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { apiService } from '@/shared/services/apiService';
import { ProjectStatus, ProjectPriority, ProjectResource } from '@/shared/types';
import { 
  GitBranch, 
  Folder, 
  Plus, 
  Trash2, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  FolderOpen
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_PRESETS = ['⚡', '🎨', '🚀', '🛡️', '💳', '🧠', '📦', '🌐', '⚙️', '🎯', '📱', '🔒'];

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject, agents } = useApp();

  // Wizard Step State (1: Basics, 2: Metadata, 3: Resources, 4: Review)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [color] = useState('#6366f1');
  const [description, setDescription] = useState('');

  // Step 2: Metadata
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [leadType, setLeadType] = useState<'member' | 'agent'>('agent');
  const [leadAgentId, setLeadAgentId] = useState(agents[0]?.id || 'agent-1');
  const [leadMemberName, setLeadMemberName] = useState('You (Project Lead)');

  // Step 3: Resources (GitHub repos & Local directories)
  // Starts empty — a placeholder repo that does not exist misleads more than
  // it demonstrates, and the agent would try to check it out.
  const [resources, setResources] = useState<ProjectResource[]>([]);

  /* ---------------------------------------------------------------------------
   * Create a GitHub repository for this project.
   *
   * Runs through the daemon, which shells out to `gh` as whoever is signed in
   * on this machine. Alpha never handles a GitHub token — same ambient-auth
   * model as the agent CLIs.
   * ------------------------------------------------------------------------ */
  const [ghAuth, setGhAuth] = useState<{ authenticated: boolean; username?: string } | null>(null);
  const [ghRepoName, setGhRepoName] = useState('');
  const [ghVisibility, setGhVisibility] = useState<'private' | 'public'>('private');
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);

  // Repository owner: '' means the personal account, anything else is an org login.
  const [ghOrgs, setGhOrgs] = useState<Array<{ login: string; role: string }>>([]);
  const [ghOwner, setGhOwner] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    apiService.checkGitHubAuth().then(setGhAuth).catch(() => setGhAuth({ authenticated: false }));
    // Orgs are a separate call so a missing read:org scope degrades to
    // "personal only" instead of breaking the whole dialog.
    apiService.listGitHubOrgs().then(setGhOrgs).catch(() => setGhOrgs([]));
  }, [isOpen]);

  // Default the repo name to a slug of the project name, until edited.
  useEffect(() => {
    if (!ghRepoName && name.trim()) {
      setGhRepoName(name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  }, [name]);

  const handleCreateRepo = async () => {
    const repoName = ghRepoName.trim();
    if (!repoName) return;

    setGhBusy(true);
    setGhError(null);
    try {
      const repo = await apiService.createGitHubRepo({
        name: repoName,
        visibility: ghVisibility,
        description: description.trim() || undefined,
        org: ghOwner || undefined,
        initReadme: true
      });

      setResources(prev => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          type: 'github_repo',
          name: repo.nameWithOwner,
          pathOrUrl: repo.url,
          branchOrMachine: 'main'
        }
      ]);
      setGhRepoName('');
    } catch (err) {
      // Surface the real reason — a name collision is the common case and the
      // user can fix it immediately.
      setGhError(err instanceof Error ? err.message : String(err));
    } finally {
      setGhBusy(false);
    }
  };
  const [newResType, setNewResType] = useState<'github_repo' | 'local_dir'>('local_dir');
  const [newResName, setNewResName] = useState('');
  const [newResPath, setNewResPath] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFolderPicker = async () => {
    if ((window as any).alphaAPI?.selectFolder) {
      const picked = await (window as any).alphaAPI.selectFolder();
      if (picked) {
        setNewResPath(picked);
        const folderName = picked.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'local-project';
        setResources(prev => [
          ...prev,
          {
            id: `res-${Date.now()}`,
            type: 'local_dir',
            name: folderName,
            pathOrUrl: picked,
            branchOrMachine: 'Local Machine'
          }
        ]);
      }
    } else if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0] as any;
      const fullPath = firstFile.path || (firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : firstFile.name);
      const folderName = firstFile.webkitRelativePath ? firstFile.webkitRelativePath.split('/')[0] : (firstFile.name || 'local-project');
      
      setNewResPath(fullPath);
      setResources(prev => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          type: 'local_dir',
          name: folderName,
          pathOrUrl: fullPath,
          branchOrMachine: 'Local Machine'
        }
      ]);
    }
    if (e.target) e.target.value = '';
  };

  const handleAddResource = () => {
    if (!newResPath.trim()) {
      if (newResType === 'local_dir') {
        handleOpenFolderPicker();
      }
      return;
    }
    const nameToUse = newResName.trim() || (newResType === 'github_repo' ? newResPath.split('/').pop() || 'repo' : 'local-workspace');
    setResources(prev => [
      ...prev,
      {
        id: `res-${Date.now()}`,
        type: newResType,
        name: nameToUse,
        pathOrUrl: newResPath.trim(),
        branchOrMachine: newResType === 'github_repo' ? 'main' : 'Local Machine'
      }
    ]);
    setNewResName('');
    setNewResPath('');
  };

  const handleRemoveResource = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const chosenLeadAgent = agents.find(a => a.id === leadAgentId);
    const keyToUse = key.trim() || name.substring(0, 3).toUpperCase();

    createProject({
      name: name.trim(),
      key: keyToUse.toUpperCase(),
      description: description.trim(),
      icon,
      color,
      status,
      priority,
      startDate,
      targetDate,
      leadType,
      leadName: leadType === 'agent' ? chosenLeadAgent?.name : leadMemberName,
      leadAgentId: leadType === 'agent' ? leadAgentId : undefined,
      resources
    });

    handleClose();
  };

  const handleClose = () => {
    setName('');
    setKey('');
    setDescription('');
    setCurrentStep(1);
    onClose();
  };

  const canProceedFromStep1 = name.trim().length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Project"
      subtitle="A shared workspace grouping issues and ground rules so agents have unified context."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ================= STEPPER PROGRESS HEADER ================= */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          {[
            { step: 1, label: 'Basics' },
            { step: 2, label: 'Metadata' },
            { step: 3, label: 'Resources' },
            { step: 4, label: 'Review' }
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isActive = currentStep === item.step;

            return (
              <div
                key={item.step}
                className={`flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors ${
                  isActive ? 'text-white font-semibold' : isCompleted ? 'text-brand-400' : 'text-gray-500'
                }`}
                onClick={() => {
                  if (item.step < currentStep || (item.step === 2 && canProceedFromStep1)) {
                    setCurrentStep(item.step);
                  }
                }}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono transition-colors ${
                    isActive
                      ? 'bg-brand-500 text-white'
                      : isCompleted
                      ? 'bg-brand-500/20 text-brand-300'
                      : 'bg-[#181920] text-gray-500 border border-white/5'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : item.step}
                </span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* ================= STEP 1: BASICS ================= */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in">
            {/* Icon, Name & Key */}
            <div className="flex items-start gap-3">
              {/* Icon Picker */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-gray-400">Icon</label>
                <div className="relative group">
                  <div 
                    className="w-12 h-10 rounded-xl bg-[#14151B] border border-white/10 flex items-center justify-center text-xl cursor-pointer hover:border-brand-500/50 transition-colors"
                  >
                    {icon}
                  </div>
                  <div className="absolute top-full left-0 mt-1 p-2 bg-[#1A1B22] border border-white/10 rounded-xl shadow-2xl z-30 hidden group-hover:grid grid-cols-4 gap-1.5 w-40">
                    {ICON_PRESETS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setIcon(emoji)}
                        className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!key) setKey(e.target.value.substring(0, 3).toUpperCase());
                  }}
                  placeholder="e.g. E-Wallet Architecture"
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>

              {/* Key Prefix */}
              <div className="w-24">
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Key Prefix</label>
                <input
                  type="text"
                  maxLength={5}
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="EWL"
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono uppercase text-center focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Description / Shared Agent Context */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-gray-400">
                  Goal & Ground Rules <span className="text-gray-500">(Fed directly to AI Agents)</span>
                </label>
                <span className="text-[10px] text-brand-400 font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Shared Context
                </span>
              </div>
              <textarea
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the objective, technical stack, and architectural constraints. Agents working on any issue inside this project receive this context automatically."
                className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 leading-relaxed font-mono"
              />
            </div>
          </div>
        )}

        {/* ================= STEP 2: METADATA & LEAD ================= */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Project Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>

            {/* Lead Coordinator */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-gray-400">Project Lead (Coordinator)</label>
                <span className="text-[10px] text-gray-500 italic">Label only; doesn't auto-assign tasks</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <select
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value as 'member' | 'agent')}
                    className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="agent">AI Agent</option>
                    <option value="member">Team Member</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  {leadType === 'agent' ? (
                    <select
                      value={leadAgentId}
                      onChange={(e) => setLeadAgentId(e.target.value)}
                      className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    >
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>
                          🤖 {a.name} ({a.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={leadMemberName}
                      onChange={(e) => setLeadMemberName(e.target.value)}
                      placeholder="e.g. Alex Rivers"
                      className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Start & Target Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-1">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-[#14151B] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: ATTACHED RESOURCES ================= */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-gray-400">Attached Repositories & Directories</label>
              <span className="text-[10px] text-gray-500 font-mono">Agents checkout and work here</span>
            </div>

            {/* Create a GitHub repository for this project */}
            <div className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-300 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-brand-400" />
                  Create a GitHub repository
                </span>
                {ghAuth && (
                  <span className="text-[10px] font-mono flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${ghAuth.authenticated ? 'bg-emerald-400' : 'bg-rose-400'}`}
                    />
                    <span className={ghAuth.authenticated ? 'text-gray-400' : 'text-rose-300'}>
                      {ghAuth.authenticated ? `gh: ${ghAuth.username ?? 'signed in'}` : 'gh not signed in'}
                    </span>
                  </span>
                )}
              </div>

              {ghAuth && !ghAuth.authenticated ? (
                <p className="text-[11px] text-gray-500">
                  Run <code className="text-gray-300">gh auth login</code> in a terminal, then reopen this
                  dialog. Alpha uses your own GitHub session and never stores a token.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <select
                      value={ghOwner}
                      onChange={(e) => setGhOwner(e.target.value)}
                      disabled={ghBusy}
                      title="Repository owner"
                      className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand-500 disabled:opacity-50 max-w-[11rem]"
                    >
                      <option value="">{ghAuth?.username ?? 'Personal'}</option>
                      {ghOrgs.length > 0 && (
                        <optgroup label="Organizations">
                          {ghOrgs.map(o => (
                            <option key={o.login} value={o.login}>{o.login}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <span className="text-xs text-gray-500 flex-shrink-0">/</span>
                    <input
                      type="text"
                      value={ghRepoName}
                      onChange={(e) => setGhRepoName(e.target.value)}
                      placeholder="repository-name"
                      disabled={ghBusy}
                      className="flex-1 min-w-0 bg-[#14151B] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                    <select
                      value={ghVisibility}
                      onChange={(e) => setGhVisibility(e.target.value as 'private' | 'public')}
                      disabled={ghBusy}
                      className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleCreateRepo}
                      disabled={ghBusy || !ghRepoName.trim()}
                      className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-medium text-white disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                      {ghBusy ? 'Creating…' : 'Create'}
                    </button>
                  </div>

                  {/* Plain members may be blocked by org policy, which is not
                      visible from the API — warn rather than fail at submit. */}
                  {ghOwner && ghOrgs.find(o => o.login === ghOwner)?.role !== 'admin' && (
                    <p className="text-[11px] text-amber-300">
                      You are a member of {ghOwner}, not an owner. Some organizations
                      only let owners create repositories.
                    </p>
                  )}

                  {ghError && (
                    <p className="text-[11px] text-rose-300 font-mono break-words">{ghError}</p>
                  )}
                </>
              )}
            </div>

            {/* Resource List */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {resources.length === 0 ? (
                <p className="p-3 text-gray-500 italic bg-[#0A0B0E] rounded-xl border border-white/5">
                  No resources attached yet. Agents will work in the default workspace.
                </p>
              ) : (
                resources.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#14151B] border border-white/5 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {res.type === 'github_repo' ? (
                        <div className="flex items-center gap-1.5 text-brand-300">
                          <GitBranch className="w-3.5 h-3.5" />
                          <span className="font-medium truncate">{res.pathOrUrl}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <Folder className="w-3.5 h-3.5" />
                          <span className="font-medium truncate">{res.pathOrUrl}</span>
                        </div>
                      )}
                      <span className="text-[10px] text-gray-500 font-sans">({res.branchOrMachine})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveResource(res.id)}
                      className="p-1 text-gray-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Hidden native OS folder picker input */}
            <input
              ref={folderInputRef}
              type="file"
              {...({ webkitdirectory: '', directory: '' } as any)}
              className="hidden"
              onChange={handleFolderInputChange}
            />

            {/* Add Resource Input Form */}
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-300">Attach Resource</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={newResType}
                  onChange={(e) => {
                    setNewResType(e.target.value as any);
                    setNewResPath('');
                  }}
                  className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 w-32 flex-shrink-0"
                >
                  <option value="local_dir">Local Folder</option>
                  <option value="github_repo">GitHub Repo</option>
                </select>

                <input
                  type="text"
                  value={newResPath}
                  onChange={(e) => setNewResPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddResource();
                    }
                  }}
                  placeholder={newResType === 'local_dir' ? 'C:/path/to/local/project or Browse...' : 'github.com/owner/repo'}
                  className="flex-1 bg-[#14151B] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />

                {newResType === 'local_dir' && (
                  <button
                    type="button"
                    onClick={handleOpenFolderPicker}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-gray-200 hover:text-white transition-colors flex-shrink-0 flex items-center gap-1.5"
                    title="Open OS file dialog to pick a folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Browse...</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddResource}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-xs font-semibold text-white transition-colors flex-shrink-0 flex items-center gap-1 shadow-sm"
                  title="Add resource"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: REVIEW & FINALIZE ================= */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in text-xs">
            {/* Overview Card */}
            <div className="p-4 rounded-xl bg-[#14151B] border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{name}</h3>
                  <span className="text-[11px] font-mono text-gray-400">Prefix: {key.toUpperCase() || name.substring(0, 3).toUpperCase()}</span>
                </div>
              </div>

              {description && (
                <p className="text-gray-300 bg-[#0A0B0E] p-2.5 rounded-lg border border-white/5 font-mono text-[11px] leading-relaxed">
                  {description}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                <div>
                  <span className="text-gray-500 block">Status</span>
                  <span className="text-white capitalize">{status.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Priority</span>
                  <span className="text-white capitalize">{priority}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Lead</span>
                  <span className="text-white truncate block">
                    {leadType === 'agent' ? agents.find(a => a.id === leadAgentId)?.name : leadMemberName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Resources</span>
                  <span className="text-white">{resources.length} attached</span>
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-[11px]">
              Issues created under this project will automatically inherit this context and ground rules.
            </p>
          </div>
        )}

        {/* ================= STEPPER FOOTER NAVIGATION ================= */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !canProceedFromStep1}
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium disabled:opacity-40 transition-colors shadow-sm"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-glow-brand transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          )}
        </div>

      </form>
    </Modal>
  );
};
