import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  Code2,
  Copy,
  FileCode2,
  FolderGit2,
  GitBranch,
  Loader2,
  MessageSquare,
  PencilLine,
  Play,
  Plus,
  Flame,
  Asterisk, Users,
  Server,
  Check} from 'lucide-react';
import { RoleBadge } from '@/shared/components/Badge';
import { Agent, ChatMessage, Squad, ToolExecutionRecord } from '@/shared/types';
import { AgentReadinessNotice } from '@/features/agents/AgentReadinessNotice';
import { ThreadProjectPicker } from '@/features/chat/ThreadProjectPicker';
import { MessageMarkdown } from './MessageMarkdown';

interface ChatTargetMenuProps {
  value: string;
  label: string;
  agents: Agent[];
  squads: Squad[];
  disabled: boolean;
  onChange: (value: string) => void;
}

/** The responder picker uses the same dark popover language as mentions and navigation. */
const ChatTargetMenu: React.FC<ChatTargetMenuProps> = ({
  value,
  label,
  agents,
  squads,
  disabled,
  onChange
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const rowClass = (selected: boolean) => `w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${
    selected ? 'bg-brand-500/12 text-white' : 'text-gray-300 hover:bg-white/[0.05] hover:text-white'
  }`;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        title="Choose who answers messages without an @mention"
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-8 min-w-[174px] max-w-[220px] flex items-center gap-2 rounded-md border border-white/[0.10] bg-surface-100/80 px-2.5 text-left text-[11px] text-gray-300 transition-colors hover:border-white/[0.20] hover:bg-surface-100 focus:outline-none focus:border-brand-500/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {value.startsWith('agent:') ? (
          <span
            className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[9px] font-semibold text-white"
            style={{ backgroundColor: agents.find(agent => `agent:${agent.id}` === value)?.color || '#6366f1' }}
          >
            {agents.find(agent => `agent:${agent.id}` === value)?.name.charAt(0) || 'A'}
          </span>
        ) : value.startsWith('squad:') ? (
          <span className="w-4 h-4 rounded-md shrink-0 flex items-center justify-center bg-brand-500/15 text-brand-300">
            <Users className="w-3 h-3" />
          </span>
        ) : (
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-brand-300" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chat responder"
          className="absolute right-0 top-full z-40 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-white/[0.10] bg-surface-raised p-1.5 shadow-2xl shadow-black/40 animate-slide-up"
        >
          <div className="px-2.5 pb-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Default responder</p>
            <p className="mt-0.5 text-[11px] text-gray-500">@mentions still override this for one message.</p>
          </div>

          <button
            type="button"
            role="menuitemradio"
            aria-checked={value === ''}
            onClick={() => choose('')}
            className={rowClass(value === '')}
          >
            <span className="w-7 h-7 rounded-md flex items-center justify-center bg-brand-500/15 text-brand-300">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">Automatic · Alpha</span>
              <span className="mt-0.5 block truncate text-[10px] text-gray-500">Let Alpha route the conversation</span>
            </span>
            {value === '' && <Check className="w-3.5 h-3.5 shrink-0 text-brand-300" />}
          </button>

          <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Agents</div>
          {agents.filter(agent => !agent.isArchived).map(agent => {
            const agentValue = `agent:${agent.id}`;
            const selected = value === agentValue;
            return (
              <button
                key={agent.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => choose(agentValue)}
                className={rowClass(selected)}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                  style={{ backgroundColor: agent.color || '#6366f1' }}
                >
                  {agent.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{agent.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-gray-500">{agent.role}</span>
                </span>
                {selected && <Check className="w-3.5 h-3.5 shrink-0 text-brand-300" />}
              </button>
            );
          })}

          {squads.length > 0 && (
            <>
              <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">Squads</div>
              {squads.map(squad => {
                const squadValue = `squad:${squad.id}`;
                const selected = value === squadValue;
                return (
                  <button
                    key={squad.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => choose(squadValue)}
                    className={rowClass(selected)}
                  >
                    <span className="w-7 h-7 rounded-md flex items-center justify-center bg-brand-500/15 text-brand-300 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{squad.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-gray-500">{squad.memberAgentIds.length} agents · sequential</span>
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0 text-brand-300" />}
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ChatView: React.FC = () => {
  const {
    chatThreads,
    activeThreadId,
    setActiveThreadId,
    createNewThread,
    deleteThread,
    sendChatMessage, 
    clearChat, 
    isAgentTyping, 
    agents, 
    skills,
    activeChatAgentId,
    setActiveChatAgentId,
    activeChatSquadId,
    setActiveChatSquadId,
    setChatThreadTarget,
    updateAgent,
    setActiveTab,
    role,
    users,
    can,
    showToast
  } = useApp();

  const [input, setInput] = useState('');
  const [callInstruction, setCallInstruction] = useState('');
  const [showCallPanel, setShowCallPanel] = useState(false);
  const [snapshot, setSnapshot] = useState<ProjectChatSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [selectedSquadId, setSelectedSquadId] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [mode, setMode] = useState<AgentCallMode>('ask');
  const [targetType, setTargetType] = useState<AgentCallTarget['type']>('issue');
  const [targetId, setTargetId] = useState('');
  const [calls, setCalls] = useState<Record<string, AgentCall>>({});
  const [busyCallId, setBusyCallId] = useState<string | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [copiedCallId, setCopiedCallId] = useState<string | null>(null);
  const [expandedCallPanel, setExpandedCallPanel] = useState<Record<string, boolean>>({});
  const callsRef = useRef<Record<string, AgentCall>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeThread = useMemo(
    () => chatThreads.find(thread => thread.id === activeThreadId) ?? null,
    [chatThreads, activeThreadId]
  );
  const currentMessages = activeThread?.messages ?? [];
  const isClient = role === 'client';
  const project = projects.find(item => item.id === activeThread?.projectId);
  const projectIssues = issues.filter(issue => issue.projectId === activeThread?.projectId);
  const pmName = users.find(user => user.role === 'pm')?.name ?? 'your project manager';
  const selectedAgent = snapshot?.agents.find(agent => agent.id === selectedAgentId);
  const visibleModes = selectedAgent?.supportedModes ?? [];

  const callList = useMemo(
    () => Object.values(calls).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [calls]
  );
  const highlightedCall = callList[0];
  const activeCall = callList.find(call => ['queued', 'running', 'awaiting_confirmation'].includes(call.status));

  useEffect(() => {
    callsRef.current = calls;
  }, [calls]);

  // Keep the legacy context pointers in sync for other surfaces, while the
  // thread itself remains the durable source of truth when conversations are
  // switched or reloaded.
  useEffect(() => {
    setActiveChatAgentId(activeThread?.targetAgentId ?? null);
    setActiveChatSquadId(activeThread?.targetSquadId ?? null);
  }, [activeThread?.id, activeThread?.targetAgentId, activeThread?.targetSquadId, setActiveChatAgentId, setActiveChatSquadId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, isAgentTyping, highlightedCall?.status]);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setSnapshotError(null);
    setCalls({});
    setSelectedAgentId('');
    setSelectedSquadId('');
    setShowCallPanel(false);

    if (isClient || !activeThread?.projectId) return undefined;
    setLoadingSnapshot(true);
    Promise.all([
      apiService.getProjectChatAgents(activeThread.projectId),
      apiService.getThreadAgentCalls(activeThread.projectId, activeThread.id)
    ]).then(([nextSnapshot, nextCalls]) => {
      if (cancelled) return;
      setSnapshot(nextSnapshot);
      setCalls(Object.fromEntries(nextCalls.calls.map(call => [call.id, call])));
      const firstSquad = nextSnapshot.squads[0];
      const firstAgent = firstSquad?.agents[0];
      setSelectedSquadId(firstSquad?.id ?? '');
      setSelectedAgentId(firstAgent?.id ?? '');
      setMode(firstAgent?.supportedModes.includes('ask') ? 'ask' : firstAgent?.supportedModes[0] ?? 'ask');
    }).catch((error: any) => {
      if (!cancelled) setSnapshotError(error?.message ?? 'Could not load project agents.');
    }).finally(() => {
      if (!cancelled) setLoadingSnapshot(false);
    });

    return () => { cancelled = true; };
  }, [activeThread?.id, activeThread?.projectId, isClient]);

  useEffect(() => {
    if (!visibleModes.includes(mode)) setMode(visibleModes[0] ?? 'ask');
  }, [mode, visibleModes]);

  useEffect(() => {
    const projectId = activeThread?.projectId;
    const threadId = activeThread?.id;
    if (isClient || !projectId || !threadId) return undefined;

    const updateFromSocket = (payload: Partial<AgentCall> & Pick<AgentCall, 'id'>) => {
      const existing = payload?.id ? callsRef.current[payload.id] : undefined;
      if (!existing) return;
      const next = {
        ...existing,
        ...payload,
        artifacts: payload.artifacts ?? existing.artifacts
      };
      callsRef.current[payload.id] = next;
      setCalls(prev => ({ ...prev, [payload.id]: next }));
      if (['completed', 'failed', 'cancelled'].includes(payload.status ?? '')) {
        void Promise.all([
          apiService.getAgentCall(payload.id).then(result => {
            callsRef.current[result.call.id] = result.call;
            setCalls(prev => ({ ...prev, [result.call.id]: result.call }));
          }).catch(() => undefined),
          refreshChatThread(threadId)
        ]);
      }
    };
    const eventNames = [
      'agent_call.created',
      'agent_call.queued',
      'agent_call.started',
      'agent_call.completed',
      'agent_call.failed',
      'agent_call.cancelled'
    ];
    const unsubscribers = eventNames.map(eventName => runnerSocket.on(eventName, updateFromSocket));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [activeThread?.id, activeThread?.projectId, isClient, refreshChatThread]);

  useEffect(() => {
    const projectId = activeThread?.projectId;
    const threadId = activeThread?.id;
    if (isClient || !projectId || !threadId || !activeCall) return undefined;

    let cancelled = false;
    const syncCall = async () => {
      try {
        const result = await apiService.getAgentCall(activeCall.id);
        if (cancelled) return;
        setCalls(prev => ({ ...prev, [result.call.id]: result.call }));
        if (['completed', 'failed', 'cancelled'].includes(result.call.status)) {
          await refreshChatThread(threadId);
        }
      } catch {
        // The socket remains the primary path; polling recovers missed frames.
      }
    };
    const timer = window.setInterval(() => void syncCall(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCall?.id, activeCall?.status, activeThread?.id, activeThread?.projectId, isClient, refreshChatThread]);

  const selectSquad = (squadId: string) => {
    setSelectedSquadId(squadId);
    const first = snapshot?.squads.find(squad => squad.id === squadId)?.agents[0];
    setSelectedAgentId(first?.id ?? '');
    setMode(first?.supportedModes.includes('ask') ? 'ask' : first?.supportedModes[0] ?? 'ask');
  };

  const targetOptions = useMemo(() => {
    if (targetType === 'issue') {
      return projectIssues.map(issue => ({ id: issue.id, label: `${issue.identifier} · ${issue.title}` }));
    }
    if (targetType === 'message' || targetType === 'agent_response') {
      return currentMessages
        .filter(message => message.senderType !== 'system')
        .map(message => ({
          id: message.id,
          label: `${message.senderName} · ${message.content.slice(0, 72)}`
        }));
    }
    return [];
  }, [currentMessages, projectIssues, targetType]);

  const makeTarget = (): AgentCallTarget | undefined => {
    if (mode === 'ask' && !targetId) return undefined;
    if (!targetId.trim()) return undefined;
    const option = targetOptions.find(item => item.id === targetId);
    return {
      type: targetType,
      id: targetId.trim(),
      label: option?.label ?? targetId.trim()
    };
  };

  const openCallPanel = () => {
    if (isClient) return;
    if (!activeThread?.projectId) {
      showToast('Choose a project first', 'Agent calls can only inspect an assigned project.', 'info');
      return;
    }
    if (!snapshot?.agents.length) {
      showToast('No project agents available', 'This project has no ready agent in an assigned squad on this machine.', 'info');
      return;
    }
    setShowCallPanel(true);
  };

  const handleChatTargetChange = (value: string) => {
    const separator = value.indexOf(':');
    const kind = separator >= 0 ? value.slice(0, separator) : '';
    const id = separator >= 0 ? value.slice(separator + 1) : '';
    const targetAgentId = kind === 'agent' && id ? id : null;
    const targetSquadId = kind === 'squad' && id ? id : null;

    setActiveChatAgentId(targetAgentId);
    setActiveChatSquadId(targetSquadId);
    if (activeThread) {
      setChatThreadTarget(activeThread.id, {
        agentId: targetAgentId,
        squadId: targetSquadId
      });
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAgentTyping) return;
    const msg = input.trim();
    setInput('');
    await sendChatMessage(msg, {
      agentId: selectedAgentId ?? null,
      squadId: selectedSquadId ?? null
    });
  };

  const confirmCall = async (call: AgentCall) => {
    setBusyCallId(call.id);
    try {
      const result = await apiService.confirmAgentCall(call.id);
      setCalls(prev => ({ ...prev, [call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Confirmation failed', error?.message ?? 'The call could not be confirmed.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const selectedAgentId = activeThread ? activeThread.targetAgentId : activeChatAgentId;
  const selectedSquadId = activeThread ? activeThread.targetSquadId : activeChatSquadId;
  const activeAgent = selectedAgentId
    ? agents.find(agent => agent.id === selectedAgentId)
    : undefined;
  const activeSquad = selectedSquadId
    ? squads.find(squad => squad.id === selectedSquadId)
    : undefined;
  const chatTargetValue = activeAgent
    ? `agent:${activeAgent.id}`
    : activeSquad
      ? `squad:${activeSquad.id}`
      : '';
  const chatTargetLabel = activeAgent
    ? `${activeAgent.name} · ${activeAgent.role}`
    : activeSquad
      ? `${activeSquad.name} · ${activeSquad.memberAgentIds.length} agents`
      : 'Automatic · Alpha';
  const isClient = role === 'client';
  const pmName = users.find(u => u.role === 'pm')?.name ?? 'your project manager';

  // A client is talking to a person about scope and money, not to an agent
  // about models and test suites.
  const quickStarters = isClient
    ? [
        { label: 'Ask about the price', prompt: 'Can you explain what is driving the engineering oversight figure?' },
        { label: 'Change something', prompt: 'I would like to drop a feature from the first version — what happens to the timeline?' },
        { label: 'Ask about timing', prompt: 'When would we realistically be able to launch this?' },
        { label: 'Request a call', prompt: 'Could we talk this through on a call before I approve?' }
      ]
    : [
        { label: 'Switch Squad Model', prompt: 'Switch Frontend Squad to DeepSeek V4 reasonix model.' },
        { label: 'Audit Socket Backoff', prompt: '@Ada @Kaelen please audit our WebSocket reconnect strategy on ALF-104 with jitter.' },
        { label: 'Generate Playwright Tests', prompt: '@Nyx generate end-to-end regression tests for the Agent Canvas.' },
        { label: 'Security & Static Analysis', prompt: '@Vesper run static analysis on recent PR diffs for injection hazards.' }
      ];

  const retryCall = async (call: AgentCall) => {
    setBusyCallId(call.id);
    try {
      const result = await apiService.retryAgentCall(call.id);
      setCalls(prev => ({ ...prev, [call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Retry failed', error?.message ?? 'The call could not be retried.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

  const followUpCall = async (call: AgentCall) => {
    const instruction = window.prompt('Follow up with this agent:', 'Please go deeper on the highest-priority finding.')?.trim();
    if (!instruction) return;
    setBusyCallId(call.id);
    try {
      const result = await apiService.followUpAgentCall(call.id, instruction);
      setCalls(prev => ({ ...prev, [result.call.id]: result.call }));
      if (activeThread) await refreshChatThread(activeThread.id);
    } catch (error: any) {
      showToast('Follow-up failed', error?.message ?? 'The follow-up could not be created.', 'error');
    } finally {
      setBusyCallId(null);
    }
  };

      {/* Right Column: Active Conversation Canvas or Empty State */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-shell">
        {activeThread ? (
          <>
            {/* Active Thread Header */}
            <div className="h-14 px-6 border-b border-white/[0.06] bg-shell flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-8 flex items-center justify-center flex-shrink-0">
                  {activeThread.iconType === 'flame' ? (
                    <Flame className="w-4 h-4 text-orange-400 fill-orange-400/20" />
                  ) : (
                    <Asterisk className="w-4 h-4 text-white stroke-[2.5]" />
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate">
                    {activeThread.title}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    <span className="text-brand-400">
                      {isClient ? `${pmName} · Project Manager` : chatTargetLabel}
                    </span>
                    <span>•</span>
                    <span>{currentMessages.length} messages</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Choose the default responder for this thread. Explicit
                    @mentions still override this choice for one message. */}
                {!isClient && (
                  <div className="flex items-center gap-1.5">
                    <ChatTargetMenu
                      value={chatTargetValue}
                      label={chatTargetLabel}
                      agents={agents}
                      squads={squads}
                      disabled={isAgentTyping}
                      onChange={handleChatTargetChange}
                    />
                    <select
                      aria-hidden="true"
                      tabIndex={-1}
                      style={{ display: 'none' }}
                      value={chatTargetValue}
                      disabled={isAgentTyping}
                      onChange={e => handleChatTargetChange(e.target.value)}
                      title="Choose who answers messages without an @mention"
                      className="bg-surface-100 border border-white/10 rounded-md px-2 py-1 text-[11px] text-gray-200 hover:border-white/20 focus:outline-none focus:border-brand-500 disabled:opacity-50 max-w-[190px] truncate"
                    >
                      <option value="">Automatic · Alpha</option>
                      <optgroup label="Agents">
                        {agents
                          .filter(agent => !agent.isArchived)
                          .map(agent => (
                            <option key={agent.id} value={`agent:${agent.id}`}>
                              {agent.name} · {agent.role}
                            </option>
                          ))}
                      </optgroup>
                      {squads.length > 0 && (
                        <optgroup label="Squads">
                          {squads.map(squad => (
                            <option key={squad.id} value={`squad:${squad.id}`}>
                              {squad.name} · {squad.memberAgentIds.length} agents
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}

                {/* Which repository the agents in this thread can read. Hidden
                    for client threads, which never address an agent. */}
                {!isClient && (
                  <ThreadProjectPicker
                    key={activeThread.id}
                    threadId={activeThread.id}
                    projectId={activeThread.projectId}
                  />
                )}

                {/* The inspector configures an agent's model and prompt. There
                    is no agent behind a client conversation. */}
                {!isClient && activeAgent && (
                  <button
                    onClick={() => setShowInspector(!showInspector)}
                    className={`p-2 rounded-md text-xs flex items-center gap-1.5 transition-colors ${
                      showInspector
                        ? 'bg-white/[0.05] text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                    title="Toggle Agent Inspector"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline font-sans">Inspector</span>
                  </button>
                )}

                <button
                  onClick={() => clearChat()}
                  className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                  title="Clear conversation messages"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => deleteThread(activeThread.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-colors text-xs"
                  title="Delete this chat thread"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Message Thread Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
              {currentMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-10 h-10 flex items-center justify-center text-brand-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-white">
                      {isClient ? `Message ${pmName}` : 'Start a new agent session'}
                    </h3>
                    <p className="text-xs text-gray-400 max-w-sm">
                      {isClient
                        ? `${pmName} manages your project and usually replies within a few hours. Ask about scope, price, or timing.`
                        : activeAgent
                          ? `Messages without an @mention go directly to ${activeAgent.name}. You can still mention another agent for a one-off reply.`
                          : activeSquad
                            ? `${activeSquad.name} will answer in sequence. Mention a specific agent to get a one-off reply.`
                            : 'Choose an agent or squad above, or leave it on Automatic to chat with Alpha. You can also use @mentions for one-off routing.'}
                    </p>
                  </div>
                </div>
              ) : (
                currentMessages.map((msg: ChatMessage) => {
                  const isUser = msg.senderType === 'user';
                  const isSystem = msg.senderType === 'system';
                  const thinkingOpen = expandedThinking[msg.id] ?? false;
                  const messageAgent = msg.agentId
                    ? agents.find(agent => agent.id === msg.agentId)
                    : undefined;

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-3">
                        <div className="px-4 py-1.5 rounded-full bg-surface-100 border border-white/5 text-xs text-gray-400 font-mono flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                          <span>{msg.content}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3.5 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      {/* Avatar */}
                      {isUser ? (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-on-accent flex-shrink-0">
                          U
                        </div>
                      ) : msg.senderAvatar || messageAgent?.avatar ? (
                        <img
                          src={msg.senderAvatar || messageAgent?.avatar}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0"
                        />
                      ) : (
                        // Client threads have no agent behind them — the other
                        // party is a person, shown by initial.
                        <div className="w-9 h-9 rounded-full bg-white/[0.08] border border-white/10 flex items-center justify-center text-xs font-semibold text-gray-200 flex-shrink-0">
                          {msg.senderName?.[0] ?? '·'}
                        </div>
                      )}

                      {/* Message Body */}
                      <div className={`space-y-2.5 flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className={`flex items-center gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-xs font-bold text-gray-300">{msg.senderName}</span>
                          <span className="text-xs font-mono text-gray-500">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Thinking Accordion */}
                        {msg.thinkingProcess && (
                          <div className="border border-indigo-500/20 bg-indigo-950/20 rounded-xl overflow-hidden text-xs">
                            <button
                              onClick={() => toggleThinking(msg.id)}
                              className="w-full flex items-center justify-between px-4 py-2 text-indigo-300 hover:bg-indigo-500/10 transition-colors font-mono text-xs"
                            >
                              <span className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-indigo-400" />
                                <span className="font-semibold">Agent Chain-of-Thought & Reasoning</span>
                              </span>
                              {thinkingOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>

                            {thinkingOpen && (
                              <div className="p-4 border-t border-indigo-500/20 text-indigo-200/90 font-mono text-xs leading-relaxed bg-black/30">
                                {msg.thinkingProcess}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Tool Executions Chips */}
                        {msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                          <div className="space-y-1.5">
                            {msg.toolsExecuted.map((tool: ToolExecutionRecord, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-300/80 border border-white/5 text-xs font-mono"
                              >
                                <div className="flex items-center gap-2.5 truncate text-cyan-300">
                                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                                  <span className="font-semibold">{tool.name}</span>
                                  <span className="text-gray-400 truncate max-w-xs">{tool.input}</span>
                                </div>
                                <span className="text-gray-500 text-xs ml-2 flex-shrink-0">{tool.durationMs}ms</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Content Bubble */}
                        <div
                          className={`p-4 rounded-2xl text-sm sm:text-base leading-relaxed ${
                            isUser
                              ? 'bg-brand-500 text-on-accent rounded-tr-none shadow-glow-brand'
                              : 'bg-surface-100 border border-white/10 text-gray-100 rounded-tl-none'
                          }`}
                        >
                          {msg.isStreaming ? (
                            <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs">
                              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                              <span>Generating response & executing toolhooks...</span>
                            </div>
                          ) : (
                            /*
                             * A user's own message is what they typed, so it is
                             * shown as typed. An agent's is markdown, and was
                             * being displayed as its own source code.
                             */
                            isUser ? (
                              <div className="whitespace-pre-wrap font-sans break-words">
                                {msg.content}
                              </div>
                            ) : (
                              <MessageMarkdown content={msg.content} />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

  const startNewThread = () => {
    const projectId = !isClient ? activeThread?.projectId ?? projects[0]?.id : undefined;
    createNewThread('New project conversation', projectId);
  };

            {/* Input Composer Bar */}
            <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-surface space-y-3">
              {/* Shown above the composer rather than after a failed send: the
                  agent cannot answer, and finding that out by waiting for an
                  error is the experience this replaces. */}
              {activeAgent && (
                <AgentReadinessNotice
                  agent={activeAgent}
                  onOpenRuntimes={() => setActiveTab('runtimes')}
                />
              )}
              <form onSubmit={handleSend} className="relative flex items-center gap-2">
                {/* @mention picker — only while an @token is being typed */}
                {mentionMatches.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-surface-raised shadow-2xl z-30 py-1">
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-gray-500 border-b border-white/5">
                      Mention an agent or squad
                    </div>
                    {mentionMatches.map((option, i) => (
                      <button
                        key={option.id}
                        type="button"
                        onMouseEnter={() => setMentionIndex(i)}
                        onClick={() => applyMention(option.token)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                          i === mentionIndex ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 flex items-center justify-center text-[10px] font-semibold text-white shrink-0 ${
                            option.kind === 'squad' ? 'rounded-md bg-white/10' : 'rounded-full'
                          }`}
                          style={
                            option.kind === 'agent'
                              ? { backgroundColor: option.agent.color || '#6366f1' }
                              : undefined
                          }
                        >
                          {option.kind === 'squad' ? <Users className="w-3 h-3" /> : option.label.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-white truncate">{option.label}</span>
                          <span className="block text-[10px] text-gray-500 truncate">{option.detail}</span>
                        </span>
                        {option.kind === 'agent' ? (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              option.agent.machineStatus === 'offline' ? 'bg-rose-400' : 'bg-emerald-400'
                            }`}
                          />
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-600 shrink-0">
                            squad
                          </span>
                        )}
                      </button>
                    ))}
                    <div className="px-3 py-1.5 text-[10px] text-gray-600 border-t border-white/5">
                      ↑↓ to choose · Enter or Tab to insert
                    </div>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    isClient
                      ? `Write a message to ${pmName}...`
                      : activeAgent
                        ? `Message ${activeAgent.name}...`
                        : activeSquad
                          ? `Message ${activeSquad.name}...`
                          : 'Ask Alpha, choose an agent above, or use @mentions...'
                  }
                  disabled={isAgentTyping}
                  className="w-full bg-surface-100 border border-white/10 rounded-2xl px-5 py-3.5 text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-medium pr-14 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isAgentTyping}
                  className="absolute right-2.5 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-30 text-on-accent transition-all shadow-glow-brand"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty State (Pixel-Perfect to Screenshot: "Pick a conversation, or start a new one with +") */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            {/* Outlined Speech Bubble Icon */}
            <div className="text-gray-500/80">
              <svg 
                className="w-16 h-16 stroke-current stroke-[1.25] fill-none" 
                viewBox="0 0 24 24"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs font-semibold text-white">{agent?.name ?? call.agentId}</span><span className="text-[10px] text-gray-500">{agent?.role ?? 'Project agent'}</span><span className="text-[10px] text-gray-600">·</span><span className="text-[10px] text-gray-500">{formatDate(call.createdAt)}</span></div><div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5"><Users className="h-3 w-3" /><span>{agent?.squadName ?? call.squadId}</span><span>·</span><span>{project?.key ?? call.projectId}</span></div></div>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusTone(call.status)}`}>{call.status === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-pulse" />}{call.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}{statusLabel(call.status)}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-[10px]"><span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/10 px-2 py-1 text-gray-300">{MODE_META[call.operationMode].icon}{MODE_META[call.operationMode].label}</span>{call.revisionTarget && <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/10 px-2 py-1 text-gray-400"><TargetIcon type={call.revisionTarget.type} />{TARGET_LABELS[call.revisionTarget.type] ?? call.revisionTarget.type}: {call.revisionTarget.label ?? call.revisionTarget.id}</span>}</div>
        <div className="text-sm text-gray-100 leading-relaxed prose prose-invert prose-sm max-w-none"><MessageMarkdown content={message.content} /></div>
        {patch && <div className="rounded-xl border border-violet-400/20 bg-black/20 overflow-hidden"><button type="button" onClick={() => setExpandedDiffs(prev => ({ ...prev, [call.id]: !prev[call.id] }))} className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-violet-200 hover:bg-white/[0.04]"><span className="flex items-center gap-2"><FileCode2 className="h-3.5 w-3.5" /> Proposed patch · review before applying</span>{expandedDiffs[call.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</button>{expandedDiffs[call.id] && <pre className="max-h-72 overflow-auto border-t border-white/10 p-3 text-[11px] leading-relaxed text-gray-300">{patch}</pre>}</div>}
        {(call.error || call.status === 'awaiting_confirmation') && <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${call.status === 'awaiting_confirmation' ? 'bg-amber-500/10 text-amber-200' : 'bg-rose-500/10 text-rose-200'}`}>{call.status === 'awaiting_confirmation' ? <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}<span>{call.error || 'No files changed. Confirm the implementation call when you are ready for a proposed patch.'}</span></div>}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {call.status === 'awaiting_confirmation' && canImplement && <button type="button" disabled={busyCallId === call.id} onClick={() => void confirmCall(call)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-on-accent hover:bg-brand-400 disabled:opacity-50">{busyCallId === call.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}Confirm & generate patch</button>}
          {call.status === 'completed' && patch && canImplement && <button type="button" disabled={busyCallId === call.id} onClick={() => void applyPatch(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"><Check className="h-3 w-3" /> Apply patch</button>}
          {call.status === 'failed' && <button type="button" disabled={busyCallId === call.id} onClick={() => void retryCall(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/[0.06] disabled:opacity-50"><RefreshCw className="h-3 w-3" /> Retry</button>}
          {call.status === 'completed' && <button type="button" disabled={busyCallId === call.id} onClick={() => void followUpCall(call)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/[0.06] disabled:opacity-50"><MessageSquare className="h-3 w-3" /> Follow up</button>}
          <button type="button" onClick={() => void copyResponse(call, message)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/[0.06]">{copiedCallId === call.id ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}{copiedCallId === call.id ? 'Copied' : 'Copy'}</button>
          <button type="button" onClick={() => setExpandedCallPanel(prev => ({ ...prev, [call.id]: !expanded }))} className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300">Details {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</button>
        </div>
        {expanded && <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[10px] text-gray-500"><span>Call ID <b className="font-mono text-gray-400">{call.id.slice(-12)}</b></span><span>Requested by <b className="text-gray-400">{call.requestedBy}</b></span><span>Started <b className="text-gray-400">{call.startedAt ? new Date(call.startedAt).toLocaleTimeString() : '—'}</b></span><span>Finished <b className="text-gray-400">{call.completedAt ? new Date(call.completedAt).toLocaleTimeString() : '—'}</b></span></div>}
      </div>
    );
  };

  return (
    <div className="h-full flex overflow-hidden bg-shell text-sm text-gray-200">
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/[0.06] bg-shell sm:w-80">
        <div className="h-14 px-4 border-b border-white/[0.08] flex items-center justify-between"><div><h2 className="text-base font-semibold text-white">{isClient ? 'Messages' : 'Project chat'}</h2><p className="text-[10px] text-gray-500 mt-0.5">{activeWorkspace?.name ?? 'Workspace'}</p></div><button onClick={startNewThread} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06]" title="Start new project chat"><Plus className="w-4 h-4" /></button></div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">{chatThreads.map(thread => { const selected = activeThreadId === thread.id; const threadProject = projects.find(item => item.id === thread.projectId); return <button key={thread.id} onClick={() => setActiveThreadId(thread.id)} className={`w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors ${selected ? 'bg-white/[0.08] border-l-2 border-brand-500 pl-3.5' : 'hover:bg-white/[0.04]'}`}><span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${selected ? 'bg-brand-400 shadow-[0_0_10px_rgba(124,58,237,0.8)]' : 'bg-gray-700'}`} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className={`text-xs sm:text-sm font-semibold truncate ${selected ? 'text-white' : 'text-gray-200'}`}>{thread.title}</span><span className="text-[10px] text-gray-600 shrink-0">{formatDate(thread.lastMessageAt)}</span></span><span className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500 truncate">{threadProject ? <><FolderGit2 className="h-3 w-3 shrink-0" /> {threadProject.key}</> : 'General Alpha chat'}{thread.lastMessageSnippet && <><span>·</span><span className="truncate">{thread.lastMessageSnippet}</span></>}</span></span></button>; })}{chatThreads.length === 0 && <div className="p-6 text-xs text-gray-500">No conversations yet. Start one with +.</div>}</div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-shell">
        {activeThread ? <>
          <header className="min-h-16 px-5 lg:px-7 border-b border-white/[0.06] bg-shell flex items-center justify-between gap-4"><div className="min-w-0 flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-brand-500/15 border border-brand-400/20 flex items-center justify-center shrink-0"><Sparkles className="h-4 w-4 text-brand-300" /></div><div className="min-w-0"><h2 className="text-sm font-semibold text-white truncate">{activeThread.title}</h2><div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-gray-500"><span className="text-gray-300">{isClient ? `${pmName} · Project Manager` : activeWorkspace?.name ?? 'Workspace'}</span>{!isClient && project && <><span>·</span><span className="text-brand-300">{project.key} · {project.name}</span></>}<span>·</span><span>{currentMessages.length} messages</span></div>{!isClient && project && snapshot && <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[10px] text-gray-600"><span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" /> {snapshot.project.branch ?? 'No branch detected'}</span><span className={snapshot.project.workingCopy.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'}>● {snapshot.project.workingCopy.status === 'connected' ? 'Working copy connected' : 'No local working copy'}</span>{snapshot.project.assignedSquadNames.length > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {snapshot.project.assignedSquadNames.join(', ')}</span>}</div>}</div></div><div className="flex items-center gap-2 shrink-0">{!isClient && <ThreadProjectPicker key={activeThread.id} threadId={activeThread.id} projectId={activeThread.projectId} />}{!isClient && <button type="button" onClick={openCallPanel} className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${showCallPanel ? 'bg-brand-500 text-on-accent' : 'border border-brand-400/25 bg-brand-500/10 text-brand-200 hover:bg-brand-500/20'}`}><Bot className="h-3.5 w-3.5" /> Call Agent</button>}<button type="button" onClick={() => clearChat()} className="p-2 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-white/5" title="Clear conversation"><Trash2 className="h-4 w-4" /></button><button type="button" onClick={() => deleteThread(activeThread.id)} className="hidden md:inline-flex p-2 rounded-lg text-xs text-gray-500 hover:text-rose-300 hover:bg-white/5">Delete</button></div></header>

          {!isClient && activeCall && <div className={`mx-5 mt-4 rounded-xl border px-4 py-3 flex items-center gap-3 ${statusTone(activeCall.status)} shadow-[0_0_22px_rgba(99,102,241,0.08)]`}><div className="relative h-8 w-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0"><Bot className="h-4 w-4" />{(activeCall.status === 'running' || activeCall.status === 'queued') && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-current animate-ping opacity-70" />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs font-semibold"><span>{agentForCall(activeCall)?.name ?? activeCall.agentId}</span><span className="opacity-60">·</span><span>{MODE_META[activeCall.operationMode].label}</span><span className="opacity-60">·</span><span>{statusLabel(activeCall.status)}</span></div><p className="mt-0.5 text-[10px] opacity-75 truncate">{activeCall.status === 'awaiting_confirmation' ? 'Waiting for your confirmation before the agent generates a patch.' : activeCall.status === 'running' ? 'Reading the selected project context and preparing a safe response…' : 'The call is queued for this project.'}</p></div>{activeCall.revisionTarget && <span className="hidden md:inline-flex items-center gap-1 text-[10px] opacity-75"><TargetIcon type={activeCall.revisionTarget.type} /> {activeCall.revisionTarget.label ?? activeCall.revisionTarget.id}</span>}</div>}

          {showCallPanel && !isClient && <section className="mx-5 mt-4 rounded-2xl border border-white/10 bg-surface-100/80 p-4 lg:p-5 shadow-xl"><div className="flex items-start justify-between gap-4 mb-4"><div><div className="flex items-center gap-2"><Bot className="h-4 w-4 text-brand-300" /><h3 className="text-sm font-semibold text-white">Call an assigned agent</h3></div><p className="mt-1 text-[11px] text-gray-500">Choose the project’s squad and agent explicitly. A normal chat message never invokes an agent.</p></div><button type="button" onClick={() => setShowCallPanel(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06]"><X className="h-4 w-4" /></button></div>{loadingSnapshot ? <div className="flex items-center gap-2 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading project agents…</div> : snapshotError ? <div className="flex items-center gap-2 text-xs text-rose-300"><AlertTriangle className="h-4 w-4" /> {snapshotError}</div> : !snapshot?.squads.length ? <div className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-gray-500">No ready agent is available through a squad assigned to this project.</div> : <form onSubmit={callAgent} className="space-y-4"><div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Assigned squad</label><div className="flex gap-2 overflow-x-auto pb-1">{snapshot.squads.map(squad => <button type="button" key={squad.id} onClick={() => selectSquad(squad.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${selectedSquadId === squad.id ? 'border-brand-400/50 bg-brand-500/15 text-white' : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'}`}><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{squad.name}</span><span className="mt-1 block text-[10px] text-gray-500">{squad.agents.length} ready</span></button>)}</div></div><div className="space-y-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Agent</label><div className="grid gap-2 sm:grid-cols-2">{(snapshot.squads.find(squad => squad.id === selectedSquadId)?.agents ?? []).map(agent => <button type="button" key={agent.id} onClick={() => setSelectedAgentId(agent.id)} className={`rounded-lg border p-2.5 text-left ${selectedAgentId === agent.id ? 'border-brand-400/50 bg-brand-500/15' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}><span className="flex items-center gap-2"><span className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-semibold text-white" style={{ backgroundColor: agent.color || '#6d28d9' }}>{agent.avatar ? <img src={agent.avatar} alt="" className="h-6 w-6 rounded-md object-cover" /> : agent.name.charAt(0)}</span><span className="min-w-0"><span className="block truncate text-xs font-medium text-white">{agent.name}</span><span className="block truncate text-[10px] text-gray-500">{agent.role}</span></span></span></button>)}</div></div></div><div className="grid gap-3 sm:grid-cols-[150px_1fr]"><div className="space-y-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Mode</label><select value={mode} onChange={event => setMode(event.target.value as AgentCallMode)} className="w-full rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-xs text-gray-200 outline-none focus:border-brand-400">{visibleModes.map(value => <option key={value} value={value}>{MODE_META[value].label}</option>)}</select><p className="text-[10px] leading-relaxed text-gray-600">{MODE_META[mode].description}</p></div><div className="space-y-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Target <span className="normal-case text-gray-600">{mode === 'ask' ? 'optional' : 'required'}</span></label><div className="flex gap-2"><select value={targetType} onChange={event => { setTargetType(event.target.value as AgentCallTarget['type']); setTargetId(''); }} className="w-36 shrink-0 rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-xs text-gray-200 outline-none focus:border-brand-400">{Object.entries(TARGET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{targetOptions.length > 0 ? <select value={targetId} onChange={event => setTargetId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-xs text-gray-200 outline-none focus:border-brand-400"><option value="">Select target…</option>{targetOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input value={targetId} onChange={event => setTargetId(event.target.value)} placeholder={targetType === 'file' ? 'src/features/example.tsx' : 'Enter target id or relative path'} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-200 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-brand-400" />}</div>{targetType === 'file' && <p className="text-[10px] text-gray-600">Repository-relative only. Alpha resolves the working copy server-side.</p>}</div></div><div className="space-y-2"><label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Instruction</label><textarea value={callInstruction} onChange={event => setCallInstruction(event.target.value)} rows={3} placeholder={selectedAgent ? `What should ${selectedAgent.name} look at?` : 'Choose an agent first…'} className="w-full resize-none rounded-xl border border-white/10 bg-surface-200 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-brand-400" /></div>{mode === 'implement' && <div className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200"><ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>Implementation is two-step. This request creates a reviewable call first; you must confirm before the agent generates a patch, and applying the patch is a separate action.</span></div>}<div className="flex items-center justify-end gap-2"><button type="button" onClick={() => setShowCallPanel(false)} className="rounded-lg px-3 py-2 text-xs text-gray-500 hover:text-white">Cancel</button><button type="submit" disabled={busyCallId === 'new' || !selectedAgentId || !callInstruction.trim()} className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-on-accent hover:bg-brand-400 disabled:opacity-40">{busyCallId === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />} Call {selectedAgent?.name ?? 'agent'}</button></div></form>}</section>}

          <div className="flex-1 overflow-y-auto p-5 lg:p-7 space-y-5">{currentMessages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4"><div className="h-12 w-12 rounded-2xl border border-brand-400/20 bg-brand-500/10 flex items-center justify-center"><Sparkles className="h-6 w-6 text-brand-300" /></div><div className="space-y-1.5"><h3 className="text-base font-semibold text-white">{isClient ? `Message ${pmName}` : 'Start a project conversation'}</h3><p className="text-xs text-gray-500 max-w-md leading-relaxed">{isClient ? `${pmName} manages your project and can help with scope, progress, and timing.` : project ? `Ask Alpha a general question or call one of ${snapshot?.project.assignedSquadNames.join(', ') || 'the assigned squads'} explicitly for project work.` : 'Choose a project above before calling an agent. General Alpha chat remains available without a project.'}</p></div>{!isClient && <button type="button" onClick={openCallPanel} className="inline-flex items-center gap-2 rounded-lg border border-brand-400/25 bg-brand-500/10 px-3 py-2 text-xs font-semibold text-brand-200 hover:bg-brand-500/20"><Bot className="h-3.5 w-3.5" /> Call an assigned agent</button>}</div> : currentMessages.map(message => { const isUser = message.senderType === 'user'; const isSystem = message.senderType === 'system'; const call = message.agentCallId ? calls[message.agentCallId] : undefined; if (message.agentCallId && !isUser && call) return <div key={message.id} className="max-w-3xl mr-auto">{renderCallCard(call, message)}</div>; if (message.agentCallId && !isUser && !call) return <div key={message.id} className="max-w-3xl mr-auto rounded-xl border border-white/10 bg-surface-100 p-4 text-xs text-gray-400">Loading agent call details…</div>; if (isSystem) return <div key={message.id} className="flex justify-center"><div className="max-w-2xl rounded-xl border border-white/10 bg-surface-100 px-4 py-2 text-xs text-gray-400 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-brand-300" />{message.content}</div></div>; return <div key={message.id} className={`flex gap-3.5 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}><div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${isUser ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-on-accent' : 'bg-white/[0.08] border border-white/10 text-gray-200'}`}>{isUser ? 'U' : (message.senderName?.[0] ?? 'A')}</div><div className={`min-w-0 flex-1 space-y-2 ${isUser ? 'items-end' : 'items-start'}`}><div className={`flex items-center gap-2 ${isUser ? 'justify-end' : ''}`}><span className="text-xs font-semibold text-gray-300">{message.senderName}</span><span className="text-[10px] text-gray-600">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div><div className={`rounded-2xl p-4 text-sm leading-relaxed ${isUser ? 'bg-brand-500 text-on-accent rounded-tr-none' : 'bg-surface-100 border border-white/10 text-gray-100 rounded-tl-none'}`}>{message.isStreaming ? <span className="flex items-center gap-2 text-xs text-violet-200"><Circle className="h-2.5 w-2.5 fill-current animate-pulse" /> Responding…</span> : isUser ? <div className="whitespace-pre-wrap break-words">{message.content}</div> : <MessageMarkdown content={message.content} />}</div></div></div>; })}<div ref={messagesEndRef} /></div>

          <div className="px-5 py-2.5 bg-surface/80 border-t border-white/5 flex items-center gap-2.5 overflow-x-auto"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap">Try</span>{(isClient ? ['Clarify the current scope', 'Ask about timing'] : ['Summarize this project', 'What should I review next?']).map(prompt => <button key={prompt} type="button" onClick={() => setInput(prompt)} className="whitespace-nowrap rounded-full border border-white/10 bg-surface-100 px-3 py-1.5 text-[11px] text-gray-400 hover:border-brand-400/40 hover:text-white">{prompt}</button>)}</div>
          <div className="p-4 lg:p-5 border-t border-white/[0.08] bg-surface space-y-3">{!isClient && !activeThread.projectId && <div className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200"><FolderGit2 className="h-3.5 w-3.5" /> Choose a project in the header to enable assigned agent calls.</div>}<form onSubmit={handleSend} className="flex items-end gap-2"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(event); } }} rows={1} placeholder={isClient ? `Write a message to ${pmName}…` : 'Ask Alpha about this project…'} disabled={isAgentTyping} className="min-h-12 max-h-32 flex-1 resize-none rounded-2xl border border-white/10 bg-surface-100 px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-brand-400 disabled:opacity-50" /><button type="submit" disabled={!input.trim() || isAgentTyping} className="h-11 w-11 shrink-0 rounded-xl bg-brand-500 flex items-center justify-center text-on-accent hover:bg-brand-400 disabled:opacity-30"><Send className="h-4 w-4" /></button>{!isClient && <button type="button" onClick={openCallPanel} className="h-11 shrink-0 rounded-xl border border-brand-400/25 bg-brand-500/10 px-3 text-xs font-semibold text-brand-200 hover:bg-brand-500/20 sm:hidden"><Bot className="h-4 w-4" /></button>}</form><div className="flex items-center justify-between text-[10px] text-gray-600"><span>Shift + Enter for a new line</span><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-400" /> Project boundary enforced</span></div></div>
        </> : <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4"><MessageSquare className="h-12 w-12 text-gray-700" /><p className="text-sm text-gray-500">Pick a project conversation, or start a new one with +.</p></div>}
      </main>
    </div>
  );
};

function TargetIcon({ type }: { type: AgentCallTarget['type'] }) {
  if (type === 'file' || type === 'code' || type === 'diff') return <Code2 className="h-3 w-3" />;
  if (type === 'branch' || type === 'commit' || type === 'pull_request') return <GitBranch className="h-3 w-3" />;
  if (type === 'issue' || type === 'specification') return <Clipboard className="h-3 w-3" />;
  return <MessageSquare className="h-3 w-3" />;
}
