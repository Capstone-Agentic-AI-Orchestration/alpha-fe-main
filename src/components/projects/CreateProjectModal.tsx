import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { ProjectStatus, ProjectPriority, ProjectResource } from '../../types';
import { 
  GitBranch, 
  Folder, 
  Plus, 
  Trash2, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check
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
  const [resources, setResources] = useState<ProjectResource[]>([
    { id: 'res-1', type: 'github_repo', name: 'alpha-engine', pathOrUrl: 'github.com/multica/alpha-engine', branchOrMachine: 'main' }
  ]);
  const [newResType, setNewResType] = useState<'github_repo' | 'local_dir'>('github_repo');
  const [newResName, setNewResName] = useState('');
  const [newResPath, setNewResPath] = useState('');

  const handleAddResource = () => {
    if (!newResPath.trim()) return;
    const nameToUse = newResName.trim() || (newResType === 'github_repo' ? newResPath.split('/').pop() || 'repo' : 'local-workspace');
    setResources(prev => [
      ...prev,
      {
        id: `res-${Date.now()}`,
        type: newResType,
        name: nameToUse,
        pathOrUrl: newResPath.trim(),
        branchOrMachine: newResType === 'github_repo' ? 'main' : 'Local Computer'
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

            {/* Add Resource Input Form */}
            <div className="p-3 rounded-xl bg-[#0A0B0E] border border-white/5 space-y-2">
              <div className="text-[11px] font-medium text-gray-300">Attach Resource</div>
              <div className="flex items-center gap-2">
                <select
                  value={newResType}
                  onChange={(e) => setNewResType(e.target.value as any)}
                  className="bg-[#14151B] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500 w-32 flex-shrink-0"
                >
                  <option value="github_repo">GitHub Repo</option>
                  <option value="local_dir">Local Folder</option>
                </select>
                <input
                  type="text"
                  value={newResPath}
                  onChange={(e) => setNewResPath(e.target.value)}
                  placeholder={newResType === 'github_repo' ? 'github.com/owner/repo' : '/path/to/local/folder'}
                  className="flex-1 bg-[#14151B] border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddResource}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
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
