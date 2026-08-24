import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { deriveProjectKey } from '@/features/projects/useProjectsViewModel';
import { Project, ProjectStatus, ProjectPriority, ProjectResource } from '@/shared/types';
import {
  Circle,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Flame,
  ChevronUp,
  Minus,
  ChevronDown,
  Bot,
  User,
  GitBranch,
  Folder,
  FolderOpen,
  Calendar,
  MoreHorizontal,
  Trash2
} from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires once the daemon has confirmed the write, so the caller can open the project. */
  onCreated?: (project: Project) => void;
}

const ICON_PRESETS = ['⚡', '🎨', '🚀', '🛡️', '💳', '🧠', '📦', '🌐', '⚙️', '🎯', '📱', '🔒'];

const STATUS_OPTIONS: { id: ProjectStatus; label: string; icon: React.ReactNode }[] = [
  { id: 'planned', label: 'Planned', icon: <Circle className="w-3.5 h-3.5 text-gray-400" /> },
  { id: 'in_progress', label: 'In progress', icon: <PlayCircle className="w-3.5 h-3.5 text-cyan-400" /> },
  { id: 'paused', label: 'Paused', icon: <PauseCircle className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> },
  { id: 'cancelled', label: 'Cancelled', icon: <XCircle className="w-3.5 h-3.5 text-gray-500" /> }
];

const PRIORITY_OPTIONS: { id: ProjectPriority; label: string; icon: React.ReactNode }[] = [
  { id: 'urgent', label: 'Urgent', icon: <Flame className="w-3.5 h-3.5 text-rose-400" /> },
  { id: 'high', label: 'High', icon: <ChevronUp className="w-3.5 h-3.5 text-orange-400" /> },
  { id: 'medium', label: 'Medium', icon: <Minus className="w-3.5 h-3.5 text-amber-400" /> },
  { id: 'low', label: 'Low', icon: <ChevronDown className="w-3.5 h-3.5 text-sky-400" /> },
  { id: 'none', label: 'No priority', icon: <Circle className="w-3.5 h-3.5 text-gray-500" /> }
];

type OpenMenu = 'status' | 'priority' | 'lead' | 'repos' | 'more' | 'icon' | null;

const pillClass =
  'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-300 transition-colors';

const popoverClass =
  'absolute bottom-full mb-1.5 left-0 z-40 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2 space-y-0.5 animate-slide-up text-xs';

interface PillOption<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
}

/** One-of-N pill. Status and priority differ only in their option list. */
function PillSelect<T extends string>({
  options,
  value,
  onChange,
  open,
  onToggle,
  width
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (next: T) => void;
  open: boolean;
  onToggle: (e: React.MouseEvent) => void;
  width: string;
}) {
  const active = options.find(o => o.id === value) ?? options[0];

  return (
    <div className="relative">
      <button type="button" onClick={onToggle} className={pillClass}>
        {active.icon}
        <span>{active.label}</span>
      </button>
      {open && (
        <div className={`${popoverClass} ${width}`} onClick={(e) => e.stopPropagation()}>
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left ${
                value === opt.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Create a project from one screen.
 *
 * This was a four-step wizard collecting fourteen fields, thirteen of which had
 * defaults. Only `name` was ever required. The shape here matches
 * CreateIssueModal — title, description, a row of optional pills — because that
 * is already the house pattern for the entity people create most.
 */
export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { createProject, projects, agents } = useApp();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [leadType, setLeadType] = useState<'member' | 'agent'>('agent');
  const [leadAgentId, setLeadAgentId] = useState('');
  const [leadMemberName, setLeadMemberName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [resources, setResources] = useState<ProjectResource[]>([]);
  const [repoUrl, setRepoUrl] = useState('');

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [createAnother, setCreateAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // The key is derived, never typed. It has to be unique — see deriveProjectKey.
  const derivedKey = useMemo(() => deriveProjectKey(name, projects), [name, projects]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const resetForm = () => {
    setName('');
    setIcon('⚡');
    setDescription('');
    setStatus('planned');
    setPriority('medium');
    setLeadType('agent');
    setLeadAgentId('');
    setLeadMemberName('');
    setTargetDate('');
    setResources([]);
    setRepoUrl('');
    setOpenMenu(null);
    setError(null);
  };

  // The old dialog reset four of its fourteen fields on close, so an icon and a
  // priority chosen for one project silently became the defaults for the next.
  useEffect(() => {
    if (isOpen) {
      resetForm();
      setCreateAnother(false);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const chosenLeadAgent = agents.find(a => a.id === leadAgentId);
    const leadName = leadType === 'agent'
      ? chosenLeadAgent?.name
      : (leadMemberName.trim() || undefined);

    try {
      const created = await createProject({
        name: name.trim(),
        key: derivedKey,
        description: description.trim(),
        icon,
        color: '#6366f1',
        status,
        priority,
        targetDate,
        leadType,
        leadName,
        leadAgentId: leadType === 'agent' ? leadAgentId || undefined : undefined,
        resources
      });

      if (createAnother) {
        resetForm();
        nameRef.current?.focus();
      } else {
        // Creation ends inside the thing you made, not back on the list.
        onCreated?.(created);
        onClose();
      }
    } catch (err) {
      // createProject already toasts. Repeat it here so the reason stays visible
      // next to the button that failed.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape' && openMenu !== null) {
        // Close the popover first — Modal's own Escape handler closes the dialog.
        e.stopPropagation();
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, openMenu, canSubmit, name, description, icon, status, priority, leadType, leadAgentId, leadMemberName, targetDate, resources, createAnother]);

  const addResource = (res: ProjectResource) => setResources(prev => [...prev, res]);

  const handleAddRepo = () => {
    const url = repoUrl.trim();
    if (!url) return;
    addResource({
      id: `res-${Date.now()}`,
      type: 'github_repo',
      name: url.split('/').pop() || 'repo',
      pathOrUrl: url,
      branchOrMachine: 'main'
    });
    setRepoUrl('');
  };

  const handleOpenFolderPicker = async () => {
    if ((window as any).alphaAPI?.selectFolder) {
      const picked = await (window as any).alphaAPI.selectFolder();
      if (picked) {
        const folderName = picked.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'local-project';
        addResource({
          id: `res-${Date.now()}`,
          type: 'local_dir',
          name: folderName,
          pathOrUrl: picked,
          branchOrMachine: 'Local Machine'
        });
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
      addResource({
        id: `res-${Date.now()}`,
        type: 'local_dir',
        name: folderName,
        pathOrUrl: fullPath,
        branchOrMachine: 'Local Machine'
      });
    }
    if (e.target) e.target.value = '';
  };

  const leadLabel = leadType === 'agent'
    ? (agents.find(a => a.id === leadAgentId)?.name ?? 'Lead')
    : (leadMemberName.trim() || 'Lead');

  const toggle = (menu: Exclude<OpenMenu, null>) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(openMenu === menu ? null : menu);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New project"
      subtitle="A shared workspace grouping issues and ground rules so agents have unified context."
      maxWidth="max-w-lg"
    >
      <div className="space-y-4" onClick={() => setOpenMenu(null)}>
        {/* ---------------- Icon + name + derived key ---------------- */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={toggle('icon')}
              className="w-11 h-10 rounded-xl bg-[#14151B] border border-white/10 flex items-center justify-center text-xl hover:border-brand-500/50 transition-colors"
              title="Project icon"
            >
              {icon}
            </button>
            {openMenu === 'icon' && (
              <div
                className="absolute top-full left-0 mt-1 p-2 bg-surface-100 border border-white/15 rounded-xl shadow-2xl z-40 grid grid-cols-4 gap-1.5 w-40"
                onClick={(e) => e.stopPropagation()}
              >
                {ICON_PRESETS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setIcon(emoji);
                      setOpenMenu(null);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 relative">
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Project name"
              autoFocus
              className="w-full bg-[#14151B] border border-white/10 rounded-xl pl-3.5 pr-16 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            {/* Derived, not typed — it prefixes every issue in the project. */}
            {name.trim() && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 pointer-events-none"
                title="Issue prefix, editable later in project settings"
              >
                {derivedKey}
              </span>
            )}
          </div>
        </div>

        {/* ---------------- Description ---------------- */}
        <div className="space-y-1">
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Goal & ground rules — objective, stack, architectural constraints…"
            className="w-full bg-[#0A0B0E] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 leading-relaxed"
          />
          <p className="text-[11px] text-gray-500">
            Shared with agents as context for every issue in this project.
          </p>
        </div>

        {/* ---------------- Attached resources (added via the Repos pill) ---------------- */}
        {resources.length > 0 && (
          <div className="space-y-1.5">
            {resources.map(res => (
              <div
                key={res.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#0A0B0E] border border-white/5 font-mono text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {res.type === 'github_repo'
                    ? <GitBranch className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                    : <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                  <span className="text-white truncate">{res.pathOrUrl}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setResources(prev => prev.filter(r => r.id !== res.id))}
                  className="p-1 text-gray-500 hover:text-rose-400 transition-colors flex-shrink-0"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {resources.some(r => r.type === 'local_dir') && (
              <p className="text-[11px] text-amber-300/90">
                Agents on other machines cannot see a local path — they will fail to start.
              </p>
            )}
          </div>
        )}

        {/* ---------------- Pill toolbar ---------------- */}
        <div className="flex flex-wrap items-center gap-2 relative">
          <PillSelect
            options={STATUS_OPTIONS}
            value={status}
            onChange={(next) => { setStatus(next); setOpenMenu(null); }}
            open={openMenu === 'status'}
            onToggle={toggle('status')}
            width="w-48"
          />

          <PillSelect
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(next) => { setPriority(next); setOpenMenu(null); }}
            open={openMenu === 'priority'}
            onToggle={toggle('priority')}
            width="w-44"
          />

          {/* Lead */}
          <div className="relative">
            <button type="button" onClick={toggle('lead')} className={pillClass}>
              {leadType === 'agent'
                ? <Bot className="w-3.5 h-3.5 text-cyan-400" />
                : <User className="w-3.5 h-3.5 text-gray-400" />}
              <span className="truncate max-w-[8rem]">{leadLabel}</span>
            </button>
            {openMenu === 'lead' && (
              <div className={`${popoverClass} w-64 max-h-72 overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="text-[11px] uppercase text-gray-500 px-2 py-0.5 font-semibold">Agents</div>
                {agents.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setLeadType('agent');
                      setLeadAgentId(a.id);
                      setOpenMenu(null);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left ${
                      leadType === 'agent' && leadAgentId === a.id
                        ? 'bg-brand-500/20 text-white font-semibold'
                        : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    <span className="truncate">{a.name} ({a.role})</span>
                  </button>
                ))}
                <div className="border-t border-white/5 pt-1.5 mt-1.5 space-y-1.5">
                  <div className="text-[11px] uppercase text-gray-500 px-2 font-semibold">Team member</div>
                  <input
                    type="text"
                    value={leadMemberName}
                    onChange={(e) => {
                      setLeadType('member');
                      setLeadMemberName(e.target.value);
                    }}
                    placeholder="e.g. Alex Rivers"
                    className="w-full bg-[#14151B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <p className="text-[11px] text-gray-500 px-2 pt-1.5">
                  A label for coordination — it does not auto-assign issues.
                </p>
              </div>
            )}
          </div>

          {/* Repos — selection only. Creating a repository lives on the project,
              so an abandoned dialog can no longer orphan a real one. */}
          <div className="relative">
            <button type="button" onClick={toggle('repos')} className={pillClass}>
              <GitBranch className="w-3.5 h-3.5 text-brand-400" />
              <span>{resources.length > 0 ? `${resources.length} attached` : 'Repos'}</span>
            </button>
            {openMenu === 'repos' && (
              <div className={`${popoverClass} w-80 space-y-2`} onClick={(e) => e.stopPropagation()}>
                <div className="text-[11px] uppercase text-gray-500 px-1 font-semibold">Attach existing</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddRepo();
                      }
                    }}
                    placeholder="github.com/owner/repo"
                    className="flex-1 min-w-0 bg-[#14151B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddRepo}
                    disabled={!repoUrl.trim()}
                    className="px-2.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-xs font-medium text-white disabled:opacity-40 transition-colors flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleOpenFolderPicker}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-gray-300 hover:bg-white/5 text-left"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>Browse for a local folder…</span>
                </button>
                <p className="text-[11px] text-gray-500 px-1">
                  Need a new repository? Create one from the project once it exists.
                </p>
              </div>
            )}
          </div>

          {/* Target date. Unset it is a `⋯` overflow, because most projects
              never get one; setting it promotes the value to a real pill and the
              overflow has nothing left to offer. Same trigger, same popover. */}
          <div className="relative">
            {targetDate ? (
              <button type="button" onClick={toggle('more')} className={pillClass}>
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{targetDate}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toggle('more')}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-400 hover:text-white transition-colors"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}

            {openMenu === 'more' && (
              <div className={`${popoverClass} w-56 space-y-1.5`} onClick={(e) => e.stopPropagation()}>
                <label className="block text-[11px] font-medium text-gray-400 px-1">Target date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-[#14151B] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                />
                {targetDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetDate('');
                      setOpenMenu(null);
                    }}
                    className="text-[11px] text-gray-400 hover:text-white px-1"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Hidden native OS folder picker input */}
        <input
          ref={folderInputRef}
          type="file"
          {...({ webkitdirectory: '', directory: '' } as any)}
          className="hidden"
          onChange={handleFolderInputChange}
        />

        {error && (
          <p className="text-[11px] text-rose-300 font-mono break-words">{error}</p>
        )}

        {/* ---------------- Footer ---------------- */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 text-gray-300 select-none">
            <button
              type="button"
              role="switch"
              aria-checked={createAnother}
              aria-label="Create another project after this one"
              onClick={() => setCreateAnother(!createAnother)}
              className={`flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors ${
                createAnother ? 'border-brand-400 bg-brand-500' : 'border-white/10 bg-white/10 hover:border-white/20'
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  createAnother ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-medium">Create another</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              title="Create project (Ctrl/Cmd + Enter)"
              className="inline-flex min-w-[112px] items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
