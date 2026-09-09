import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '@/app/AppContext';
import { 
  Send, 
  Sparkles, 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Cpu, 
  ArrowUpRight,
  Shield,
  SlidersHorizontal,
  Plus,
  Flame,
  Asterisk, Users,
  Server} from 'lucide-react';
import { RoleBadge } from '@/shared/components/Badge';
import { ChatMessage, ToolExecutionRecord } from '@/shared/types';
import { AgentReadinessNotice } from '@/features/agents/AgentReadinessNotice';
import { ThreadProjectPicker } from '@/features/chat/ThreadProjectPicker';

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
    updateAgent,
    setActiveTab,
    role,
    users
  } = useApp();
  const { squads } = useApp();

  const [input, setInput] = useState('');
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [showInspector, setShowInspector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active thread details
  const activeThread = useMemo(() => {
    return chatThreads.find(t => t.id === activeThreadId) || null;
  }, [chatThreads, activeThreadId]);

  const currentMessages = useMemo(() => {
    if (!activeThread) return [];
    return activeThread.messages || [];
  }, [activeThread]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isAgentTyping]);

  const toggleThinking = (msgId: string) => {
    setExpandedThinking(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  /* ---------------------------------------------------------------------------
   * @mention autocomplete
   *
   * The backend routes a message to whichever agent is @mentioned, but until now
   * nothing told the user who exists or how their name is spelled — typing "@"
   * did nothing at all. This reads the live agent roster so the names offered
   * are always the ones the backend can actually resolve.
   * ------------------------------------------------------------------------ */
  const mentionQuery = (() => {
    // Only trigger on an @token still being typed at the end of the input.
    const match = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(input);
    return match ? match[1].toLowerCase() : null;
  })();

  /**
   * Agents first, then squads.
   *
   * A squad is offered as one entry that expands to its members when the
   * daemon resolves it — addressing four agents without typing four names.
   * The completion inserts the squad's name with the spaces removed, which is
   * what chatService matches on; it deliberately does NOT match a squad's
   * first word, because "Alpha Core Execution Squad" would otherwise make
   * "@Alpha" summon four agents instead of Alpha answering.
   */
  type MentionOption =
    | { kind: 'agent'; id: string; label: string; detail: string; token: string; agent: any }
    | { kind: 'squad'; id: string; label: string; detail: string; token: string };

  const mentionMatches: MentionOption[] = mentionQuery === null
    ? []
    : [
        ...agents
          .filter(a => !a.isArchived)
          .filter(a =>
            !mentionQuery ||
            a.name.toLowerCase().replace(/\s+/g, '').includes(mentionQuery) ||
            a.role.toLowerCase().replace(/\s+/g, '').includes(mentionQuery)
          )
          .map((a): MentionOption => ({
            kind: 'agent',
            id: a.id,
            label: a.name,
            detail: `${a.role} · ${a.modelProvider}`,
            // First name is enough for an agent and is what people type.
            token: a.name.split(' ')[0],
            agent: a
          })),
        ...squads
          .filter(sq =>
            !mentionQuery || sq.name.toLowerCase().replace(/\s+/g, '').includes(mentionQuery)
          )
          .map((sq): MentionOption => ({
            kind: 'squad',
            id: sq.id,
            label: sq.name,
            detail: `${sq.memberAgentIds.length} agents, in sequence`,
            token: sq.name.replace(/\s+/g, '')
          }))
      ].slice(0, 6);

  const [mentionIndex, setMentionIndex] = useState(0);
  useEffect(() => { setMentionIndex(0); }, [input]);

  const applyMention = (token: string) => {
    // The token is what chatService.resolveMentions() matches on: an agent's
    // first name, or a squad's name with the spaces removed.
    setInput(prev => prev.replace(/(^|\s)@([a-zA-Z0-9_-]*)$/, `$1@${token} `));
    inputRef.current?.focus();
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionMatches.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex(i => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // Enter completes the mention instead of sending a half-typed name.
      e.preventDefault();
      applyMention(mentionMatches[mentionIndex].token);
    } else if (e.key === 'Escape') {
      setMentionIndex(0);
      setInput(prev => prev + ' ');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isAgentTyping) return;
    const msg = input.trim();
    setInput('');
    await sendChatMessage(msg);
  };

  const formatThreadDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    } catch {
      return '';
    }
  };

  const activeAgent = agents.find(a => a.id === activeChatAgentId) || agents[0];
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

  return (
    <div className="h-full flex overflow-hidden bg-shell text-sm text-gray-200">
      {/* Left Column: Chat Conversations List (Matching Exact Screenshot Design) */}
      <div className="w-80 sm:w-96 border-r border-white/[0.06] flex flex-col flex-shrink-0 bg-shell">
        {/* Chat Threads Header */}
        <div className="h-14 px-4 border-b border-white/[0.08] flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            {isClient ? 'Messages' : 'Chat'}
          </h2>

          <button
            onClick={() => createNewThread()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Start new conversation (+)"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Threads List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
          {chatThreads.map((thread) => {
            const isSelected = activeThreadId === thread.id;

            return (
              <div
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`px-4 py-3.5 flex items-start gap-3.5 cursor-pointer transition-colors ${
                  isSelected 
                    ? 'bg-white/[0.08] border-l-2 border-brand-500 pl-3.5' 
                    : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Thread identity stays visible without adding another decorative container. */}
                <div className="w-6 h-8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {thread.iconType === 'flame' ? (
                    <Flame className="w-4 h-4 text-orange-400 fill-orange-400/20" />
                  ) : (
                    <Asterisk className="w-4 h-4 text-white stroke-[2.5]" />
                  )}
                </div>

                {/* Thread Info: Title, Snippet, Date */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`text-xs sm:text-sm font-semibold truncate ${
                      isSelected ? 'text-white' : 'text-gray-200'
                    }`}>
                      {thread.title}
                    </h3>
                    <span className="text-[11px] tabular-nums text-gray-500 flex-shrink-0">
                      {formatThreadDate(thread.lastMessageAt)}
                    </span>
                  </div>

                  <p className={`text-xs truncate ${
                    thread.isFailed ? 'text-rose-400 font-medium' : 'text-gray-400'
                  }`}>
                    {thread.lastMessageSnippet || 'No messages yet'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                      {isClient ? `${pmName} · Project Manager` : 'Multi-Agent Swarm'}
                    </span>
                    <span>•</span>
                    <span>{currentMessages.length} messages</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                {!isClient && (
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
                        : 'Summon any agent by typing @Ada, @Kaelen, @Vesper, @Nyx, @Cipher, or start asking questions below.'}
                    </p>
                  </div>
                </div>
              ) : (
                currentMessages.map((msg: ChatMessage) => {
                  const isUser = msg.senderType === 'user';
                  const isSystem = msg.senderType === 'system';
                  const thinkingOpen = expandedThinking[msg.id] ?? false;

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
                      ) : msg.senderAvatar || activeAgent?.avatar ? (
                        <img
                          src={msg.senderAvatar || activeAgent?.avatar}
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
                            <div className="whitespace-pre-wrap font-sans">
                              {msg.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Starters */}
            <div className="px-5 py-2.5 bg-surface/80 border-t border-white/5 flex items-center gap-2.5 overflow-x-auto">
              <span className="text-xs font-mono uppercase text-gray-500 whitespace-nowrap font-semibold">Prompts:</span>
              {quickStarters.map((qs, i) => (
                <button
                  key={i}
                  onClick={() => setInput(qs.prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-300 bg-surface-100 border border-white/10 hover:border-brand-500/50 hover:text-white whitespace-nowrap transition-colors"
                >
                  <span>{qs.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
              ))}
            </div>

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
                      : 'Ask an agent, summon a squad (@Ada, @Kaelen), or execute code...'
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

            <p className="text-sm text-gray-400 font-normal">
              Pick a conversation, or start a new one with +
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Agent Inspector Drawer */}
      {showInspector && activeAgent && activeThread && (
        <div className="w-88 bg-surface border-l border-white/[0.08] p-6 overflow-y-auto space-y-6 flex-shrink-0 hidden lg:block text-sm">
          <div className="flex items-center gap-3.5">
            <img src={activeAgent.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover ring-2 ring-brand-500/40" />
            <div>
              <h3 className="font-bold text-base text-white">{activeAgent.name}</h3>
              <RoleBadge role={activeAgent.role} className="mt-1" />
            </div>
          </div>

          {/* Model Provider */}
          <div className="p-3.5 rounded-xl bg-surface-100 border border-white/5 space-y-1 font-mono text-xs">
            <div className="text-gray-500 uppercase text-[11px] font-semibold">Inference Backend</div>
            <div className="text-cyan-300 font-bold">{activeAgent.modelName}</div>
            <div className="text-gray-400 text-xs">{activeAgent.modelProvider} Engine</div>
          </div>

          {/* Autonomy Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-500 uppercase block font-semibold">Autonomy Level</label>
            <div className="p-3 rounded-xl bg-surface-100 border border-white/5 text-amber-300 font-medium flex items-center gap-2.5 text-xs">
              <Shield className="w-4 h-4 text-amber-400" />
              <span>{activeAgent.autonomyLevel}</span>
            </div>
          </div>

          {/*
            Temperature is stored but cannot be applied.
              claude   — no temperature flag at all
              agy      — none documented
              codex    — only reachable via `-c key=value`, unverified
            This was a working slider that reached nothing: moving it changed the
            database and never the model. Shown read-only rather than deleted,
            so the stored value stays visible and the reason is stated where
            someone would otherwise go looking for the control.
          */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-500">Temperature</span>
              <span className="text-gray-500">{activeAgent.temperature?.toFixed(2) ?? '—'}</span>
            </div>
            <p className="text-[10px] text-gray-600 leading-snug">
              Not applied — the agent CLIs accept no temperature setting.
            </p>
          </div>

          {/* Persona Directives */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-gray-500 uppercase block font-semibold">System Persona</label>
            <textarea
              rows={5}
              value={activeAgent.systemPrompt}
              onChange={(e) => updateAgent(activeAgent.id, { systemPrompt: e.target.value })}
              className="w-full bg-surface-100 border border-white/10 rounded-xl p-3 text-xs text-gray-200 font-mono focus:outline-none focus:border-brand-500 leading-relaxed"
            />
          </div>

          {/*
            Granted Skills.

            This block was headed "Attached MCP Tools" and rendered `skills`,
            which are not MCP servers and, at the time, granted nothing at all:
            the runner ran every chat turn on one fixed read-only allowlist. So
            the panel showed "Filesystem Operations" and "Git & GitHub" on an
            agent that would then answer it could not edit a file. Both halves
            were wrong — the label, and the claim implied by showing it.

            The skills are real grants now (see toolPolicy on the daemon), and
            each one says which tools it hands over. `grantedTools` comes from
            the daemon so this list cannot drift from the argv it describes.
          */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono text-gray-500 uppercase block font-semibold">
              Granted Skills ({activeAgent.skills.length})
            </label>
            <div className="space-y-1.5">
              {activeAgent.skills.map(skId => {
                const sk = skills.find(s => s.id === skId);
                if (!sk) return null;
                return (
                  <div key={skId} className="p-2.5 rounded-lg bg-surface-100 border border-white/5 text-xs">
                    <div className="flex items-center gap-2.5 text-gray-300">
                      <Terminal className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span className="truncate flex-1 font-medium">{sk.name}</span>
                    </div>
                    {sk.grantedTools && sk.grantedTools.length > 0 && (
                      <div className="mt-1.5 pl-6 font-mono text-[10px] text-gray-500">
                        {sk.grantedTools.join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
              {activeAgent.skills.length === 0 && (
                <p className="text-[10px] text-gray-600 leading-snug">
                  None. This agent can read the workspace and nothing else.
                </p>
              )}
            </div>
            <p className="text-[10px] text-gray-600 leading-snug">
              Edits made in chat go straight to the working tree — no branch, no
              diff, no approval. Runs are the reviewable path.
            </p>
          </div>

          {/*
            MCP servers — the actual ones, which nothing in this panel showed.

            `alpha-github` was granted to every seeded agent the whole time and
            was never rendered anywhere, while the heading above claimed to be
            listing MCP tools. Read or write is not a property of the grant: it
            is resolved per turn from the agent's autonomy level and whether it
            holds sk-git, so it is described rather than labelled.
          */}
          <div className="space-y-2.5">
            <label className="text-xs font-mono text-gray-500 uppercase block font-semibold">
              MCP Servers ({activeAgent.mcpServers?.length ?? 0})
            </label>
            <div className="space-y-1.5">
              {(activeAgent.mcpServers ?? []).map(name => (
                <div
                  key={name}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-100 border border-white/5 text-gray-300 text-xs"
                >
                  <Server className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <span className="truncate flex-1 font-mono">{name}</span>
                </div>
              ))}
              {(activeAgent.mcpServers?.length ?? 0) === 0 && (
                <p className="text-[10px] text-gray-600 leading-snug">None granted.</p>
              )}
            </div>
            {activeAgent.mcpServers?.includes('alpha-github') && (
              <p className="text-[10px] text-gray-600 leading-snug">
                GitHub writes need sk-git and an autonomy level above Supervised.
                Pushing a branch is the ceiling — never a merge or a force-push.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
