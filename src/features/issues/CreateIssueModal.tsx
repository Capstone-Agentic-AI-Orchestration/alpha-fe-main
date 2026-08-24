import React, { useState, useEffect } from 'react';
import { useApp } from '@/app/AppContext';
import { IssuePriority, IssueStatus } from '@/shared/types';
import { 
  X, 
  Maximize2, 
  Paperclip, 
  ArrowLeftRight, 
  Folder, 
  MoreHorizontal, 
  Users, 
  Bot, 
  Tag, 
  Circle, 
  Clock, 
  PlayCircle, 
  CheckCircle2, 
  Flame, 
  ArrowUp, 
  ArrowRight, 
  ArrowDown, 
  Minus,
  Check
} from 'lucide-react';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({ isOpen, onClose }) => {
  const { createIssue, runAgentOnIssue, projects, agents, squads } = useApp();

  // Mode: 'agent' (Create with agent) vs 'manual' (Create manually)
  const [mode, setMode] = useState<'agent' | 'manual'>('agent');
  const [createAnother, setCreateAnother] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Common fields
  const [promptText, setPromptText] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || 'proj-1');
  const [selectedSquadId, setSelectedSquadId] = useState(squads[0]?.id || 'sq-1');
  const [selectedAgentId, setSelectedAgentId] = useState(agents[1]?.id || 'agent-2');
  const [status, setStatus] = useState<IssueStatus>('todo');
  const [priority, setPriority] = useState<IssuePriority>('none');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  // Popover menus
  const [openMenu, setOpenMenu] = useState<'project' | 'status' | 'priority' | 'assignee' | 'label' | 'more' | null>(null);

  const availableLabels = ['UI/UX', 'core', 'backend', 'runtime', 'frontend', 'bug', 'feature', 'performance'];

  /**
   * May be undefined, and that is a normal state — not an edge case.
   *
   * This modal is mounted unconditionally by App.tsx, so its body renders on
   * every app render including the first, before the daemon has hydrated
   * `projects`. Reading `.name` off it directly threw and unmounted the entire
   * app, which is what made "New Issue" show a blank screen.
   */
  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const activeSquad = squads.find(s => s.id === selectedSquadId);
  const activeAgent = agents.find(a => a.id === selectedAgentId);

  // Keyboard shortcut for Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape' && openMenu === null) {
        onClose();
      } else if (e.key === 'Escape' && openMenu !== null) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (mode === 'agent') {
      if (!promptText.trim()) return;

      let generatedTitle = promptText.trim().split('\n')[0];
      if (generatedTitle.length > 60) {
        generatedTitle = generatedTitle.substring(0, 57) + '...';
      }
      generatedTitle = generatedTitle.charAt(0).toUpperCase() + generatedTitle.slice(1);

      const created = createIssue({
        title: generatedTitle,
        description: promptText.trim(),
        projectId: selectedProjectId,
        priority: priority === 'none' ? 'medium' : priority,
        status: 'agent_running',
        assignedSquadId: selectedSquadId || undefined,
        assignedAgentId: selectedAgentId || undefined,
        labels: selectedLabels.length > 0 ? selectedLabels : ['agent-task'],
        subtasks: [
          'Deconstruct user prompt & analyze files',
          'Execute code modifications & test suites',
          'Submit patch & prepare PR diff'
        ]
      });

      runAgentOnIssue(created.id, selectedAgentId);

      if (createAnother) {
        setPromptText('');
      } else {
        setPromptText('');
        onClose();
      }
    } else {
      if (!title.trim() && !promptText.trim()) return;

      const issueTitle = title.trim() || promptText.trim().split('\n')[0];
      const issueDesc = description.trim() || (title ? promptText.trim() : '');

      createIssue({
        title: issueTitle,
        description: issueDesc,
        projectId: selectedProjectId,
        priority,
        status,
        assignedSquadId: selectedSquadId || undefined,
        assignedAgentId: selectedAgentId || undefined,
        labels: selectedLabels,
        subtasks: []
      });

      if (createAnother) {
        setTitle('');
        setDescription('');
        setPromptText('');
      } else {
        setTitle('');
        setDescription('');
        setPromptText('');
        onClose();
      }
    }
  };

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev => 
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={() => {
          setOpenMenu(null);
          onClose();
        }}
      />

      {/* Multica Card Dialog (Spacious & Scaled) */}
      <div 
        className={`relative w-full ${isFullscreen ? 'max-w-5xl h-[88vh]' : 'max-w-3xl min-h-[440px]'} bg-[#16171D] border border-white/15 rounded-2xl shadow-2xl overflow-visible z-10 animate-slide-up flex flex-col justify-between text-[15px]`}
        onClick={() => openMenu && setOpenMenu(null)}
      >
        {/* Top Header Bar */}
        <div>
          <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
              <span className="hover:text-gray-300">Alpha work</span>
              <span className="text-gray-600">›</span>
              <span className="text-white font-semibold">
                {mode === 'agent' ? 'Create with agent' : 'Create manually'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Subheader / Created By (in Agent mode) */}
          {mode === 'agent' && (
            <div className="px-6 pt-4 flex items-center gap-2.5 text-sm text-gray-400">
              <span>Created by</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === 'assignee' ? null : 'assignee');
                }}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/5 transition-colors font-medium text-xs"
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{activeSquad?.name || 'Product & Planning'}</span>
              </button>
            </div>
          )}

          {/* Main Input Area */}
          <div className="p-6 space-y-3">
            {mode === 'agent' ? (
              /* Agent Prompt Textarea */
              <textarea
                autoFocus
                rows={isFullscreen ? 14 : 6}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="report to me how can we improve the layout of the home page more,"
                className="w-full bg-transparent border-none text-base sm:text-lg text-gray-100 placeholder-gray-500 focus:outline-none resize-none leading-relaxed font-sans"
              />
            ) : (
              /* Manual Mode: Title + Description */
              <div className="space-y-4">
                <input
                  autoFocus
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Issue title"
                  className="w-full bg-transparent text-lg sm:text-xl font-bold text-white placeholder-gray-500 focus:outline-none border-none"
                />

                <textarea
                  rows={isFullscreen ? 12 : 5}
                  value={description || promptText}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setPromptText(e.target.value);
                  }}
                  placeholder="Add description..."
                  className="w-full bg-transparent border-none text-sm sm:text-base text-gray-300 placeholder-gray-600 focus:outline-none resize-none leading-relaxed font-sans"
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="px-6 pb-5 space-y-4">
          {/* Helper note in manual mode */}
          {mode === 'manual' && (
            <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
              <Users className="w-4 h-4 text-gray-400" />
              <span>Assigned — won't start working in Backlog.</span>
            </div>
          )}

          {/* Interactive Toolbar Pills Row */}
          <div className="flex flex-wrap items-center gap-2.5 relative text-sm">
            {/* Status Pill (in manual mode) */}
            {mode === 'manual' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === 'status' ? null : 'status');
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-300 transition-colors"
                >
                  <Circle className="w-3.5 h-3.5 text-slate-400" />
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                </button>

                {openMenu === 'status' && (
                  <div className="absolute bottom-full mb-1.5 left-0 z-40 w-48 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2 space-y-0.5 animate-slide-up text-xs">
                    {[
                      { id: 'backlog', label: 'Backlog', icon: <Circle className="w-4 h-4 text-gray-400" /> },
                      { id: 'todo', label: 'Todo', icon: <Clock className="w-4 h-4 text-slate-400" /> },
                      { id: 'in_progress', label: 'In Progress', icon: <PlayCircle className="w-4 h-4 text-amber-400" /> },
                      { id: 'agent_running', label: 'Agent Running', icon: <Bot className="w-4 h-4 text-cyan-400" /> },
                      { id: 'review', label: 'In Review', icon: <CheckCircle2 className="w-4 h-4 text-purple-400" /> },
                      { id: 'done', label: 'Done', icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" /> },
                    ].map((st) => (
                      <button
                        key={st.id}
                        onClick={() => {
                          setStatus(st.id as IssueStatus);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          status === st.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {st.icon}
                          <span>{st.label}</span>
                        </span>
                        {status === st.id && <Check className="w-4 h-4 text-brand-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Priority Pill (in manual mode) */}
            {mode === 'manual' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === 'priority' ? null : 'priority');
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-300 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5 text-gray-400" />
                  <span className="capitalize">{priority === 'none' ? 'No priority' : priority}</span>
                </button>

                {openMenu === 'priority' && (
                  <div className="absolute bottom-full mb-1.5 left-0 z-40 w-44 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2 space-y-0.5 animate-slide-up text-xs">
                    {[
                      { id: 'urgent', label: 'Urgent', icon: <Flame className="w-4 h-4 text-rose-400" /> },
                      { id: 'high', label: 'High', icon: <ArrowUp className="w-4 h-4 text-orange-400" /> },
                      { id: 'medium', label: 'Medium', icon: <ArrowRight className="w-4 h-4 text-amber-400" /> },
                      { id: 'low', label: 'Low', icon: <ArrowDown className="w-4 h-4 text-blue-400" /> },
                      { id: 'none', label: 'No priority', icon: <Minus className="w-4 h-4 text-gray-500" /> },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setPriority(p.id as IssuePriority);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          priority === p.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          {p.icon}
                          <span>{p.label}</span>
                        </span>
                        {priority === p.id && <Check className="w-4 h-4 text-brand-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignee / Squad Pill */}
            <div className="relative">
              {mode === 'manual' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === 'assignee' ? null : 'assignee');
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-300 transition-colors"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="truncate max-w-[140px]">{activeSquad?.name || activeAgent?.name || 'Assignee'}</span>
                </button>
              )}

              {openMenu === 'assignee' && (
                <div className="absolute bottom-full mb-1.5 left-0 z-40 w-72 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2.5 space-y-2.5 animate-slide-up max-h-72 overflow-y-auto text-xs">
                  <div>
                    <div className="text-[11px] font-mono uppercase text-gray-500 px-2 py-0.5 font-semibold">Squads</div>
                    {squads.map(sq => (
                      <button
                        key={sq.id}
                        onClick={() => {
                          setSelectedSquadId(sq.id);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left ${
                          selectedSquadId === sq.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="text-base">{sq.avatar}</span>
                        <span className="truncate">{sq.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-white/5 pt-1.5">
                    <div className="text-[11px] font-mono uppercase text-gray-500 px-2 py-0.5 font-semibold">Specialist Agents</div>
                    {agents.map(ag => (
                      <button
                        key={ag.id}
                        onClick={() => {
                          setSelectedAgentId(ag.id);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-left ${
                          selectedAgentId === ag.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <img src={ag.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        <span className="truncate">{ag.name} ({ag.role})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Label Pill (manual mode) */}
            {mode === 'manual' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenu(openMenu === 'label' ? null : 'label');
                  }}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-300 transition-colors"
                >
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span>{selectedLabels.length > 0 ? `${selectedLabels.length} labels` : 'Add label'}</span>
                </button>

                {openMenu === 'label' && (
                  <div className="absolute bottom-full mb-1.5 left-0 z-40 w-52 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2 space-y-1 animate-slide-up text-xs">
                    <div className="text-[11px] font-mono uppercase text-gray-500 px-2 font-semibold">Select Labels</div>
                    {availableLabels.map(l => (
                      <button
                        key={l}
                        onClick={() => toggleLabel(l)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs ${
                          selectedLabels.includes(l) ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-400 hover:bg-white/5'
                        }`}
                      >
                        <span>{l}</span>
                        {selectedLabels.includes(l) && <Check className="w-4 h-4 text-brand-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Project Pill (📁 Project ✕) */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === 'project' ? null : 'project');
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-200 transition-colors"
              >
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                <span>{activeProject?.name ?? 'No project'}</span>
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-white ml-0.5" />
              </button>

              {openMenu === 'project' && (
                <div className="absolute bottom-full mb-1.5 left-0 z-40 w-64 bg-surface-100 border border-white/15 rounded-xl shadow-2xl p-2 space-y-1 animate-slide-up text-xs">
                  <div className="text-[11px] font-mono uppercase text-gray-500 px-2 py-0.5 font-semibold">Projects</div>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedProjectId(p.id);
                        setOpenMenu(null);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left ${
                        selectedProjectId === p.id ? 'bg-brand-500/20 text-white font-semibold' : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="truncate">{p.name} ({p.key})</span>
                      {selectedProjectId === p.id && <Check className="w-4 h-4 text-brand-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* More actions pill (•••) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(openMenu === 'more' ? null : 'more');
              }}
              className="p-2 rounded-full bg-surface-200 hover:bg-surface-50 border border-white/10 text-gray-400 hover:text-white transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Footer Action Bar */}
          <div className="flex flex-col gap-3 border-t border-white/5 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Attachment */}
            <button
              type="button"
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Attach screenshot or file"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* Right: Switch Mode + Create Another Toggle + Submit Button */}
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* Switch to Agent / Switch to Manual */}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'agent' ? 'manual' : 'agent');
                  if (mode === 'agent' && promptText && !title) {
                    setTitle(promptText.split('\n')[0]);
                  }
                }}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                  mode === 'manual'
                    ? 'bg-gradient-to-r from-cyan-500/20 via-brand-500/20 to-purple-500/20 border border-brand-500/50 text-brand-200 shadow-glow-brand'
                    : 'text-gray-300 hover:text-white border border-white/10 hover:border-white/20 bg-surface-200'
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{mode === 'agent' ? 'Switch to Manual' : 'Switch to Agent'}</span>
              </button>

              {/* Create Another Toggle */}
              <div className="flex min-h-9 select-none items-center gap-2 text-gray-300">
                <button
                  type="button"
                  role="switch"
                  aria-checked={createAnother}
                  aria-label="Create another issue after this one"
                  onClick={() => setCreateAnother(!createAnother)}
                  className={`flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors ${
                    createAnother
                      ? 'border-brand-400 bg-brand-500'
                      : 'border-white/10 bg-white/10 hover:border-white/20'
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    createAnother ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
                <span className="text-xs font-medium">Create another</span>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={mode === 'agent' ? !promptText.trim() : (!title.trim() && !promptText.trim())}
                className="inline-flex min-w-[112px] items-center justify-center whitespace-nowrap rounded-md bg-white px-4 py-2.5 text-xs font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white"
                title="Create issue (Ctrl/Cmd + Enter)"
              >
                <span>Create issue</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
