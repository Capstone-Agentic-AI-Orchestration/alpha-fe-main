import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, FolderOpen, MessageSquare, Plus } from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';
import type { Skill } from '@/shared/types';
import { ChatSkillTools } from './ChatSkillTools';
import { ChatSkillCommandSuggestions, getChatSkillCommandAtCursor, matchChatSkills, MAX_SELECTED_SKILLS, type ChatSkillCommandQuery } from './ChatSkillCommand';

export interface ChatHomeRecent {
  id: string;
  title: string;
  projectName?: string;
  lastMessageAt: string;
}

export interface ChatHomeProps {
  /** The name to greet, as shown on the user's profile. */
  userName: string;
  projects: Array<{ id: string; name: string }>;
  /** The project the new chat will belong to; null for a chat with no project. */
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  message: string;
  onMessageChange: (message: string) => void;
  approvalMode: 'ask' | 'approve' | 'full';
  onApprovalModeChange: (mode: 'ask' | 'approve' | 'full') => void;
  skills: Skill[];
  selectedSkillIds: string[];
  onSkillIdsChange: (ids: string[]) => void;
  onImprovePrompt: (draft: string, skillIds: string[]) => Promise<string>;
  onPromptError: (message: string) => void;
  onScanSkills?: () => Promise<void>;
  scanningSkills?: boolean;
  /** Creates the conversation and sends the first message. */
  onSend: () => void;
  canSend: boolean;
  /** Why sending is unavailable, shown in place of the hint. */
  blockedReason?: string;
  recent: ChatHomeRecent[];
  onOpenRecent: (threadId: string) => void;
}

/** "Lloyd1020", "LloydLim1" or "lloyd.lim" reads as "Lloyd". */
export function greetingName(name: string): string {
  const token = name.trim().split(/[\s._@-]+/)[0]?.replace(/\d+$/, '') ?? '';
  // A joined-up login such as "LloydLim" keeps only its first word.
  const first = token.split(/(?<=[a-z])(?=[A-Z])/)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

/** A project menu that follows the selected palette, including its open options. */
function ProjectPicker({ projects, projectId, onChange }: {
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  onChange: (projectId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options: Array<{ id: string | null; name: string }> = [{ id: null, name: 'No project' }, ...projects];
  const selected = options.find(option => option.id === projectId) ?? options[0];
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const choose = (id: string | null) => { onChange(id); setOpen(false); };

  return <div ref={rootRef} className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} aria-haspopup="listbox" aria-expanded={open} aria-label={'Project: ' + selected.name}
      className={'flex max-w-60 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus '
        + (projectId ? 'border-divider bg-selected text-selected-content hover:bg-selected' : 'border-divider bg-surface-raised text-content-secondary hover:bg-surface-high')}>
      <FolderOpen className={'h-3.5 w-3.5 shrink-0 ' + (projectId ? 'text-link' : 'text-content-secondary')} aria-hidden="true" />
      <span className="truncate">{selected.name}</span>
      <ChevronDown className={'h-3.5 w-3.5 shrink-0 text-content-secondary transition-transform ' + (open ? 'rotate-180' : '')} aria-hidden="true" />
    </button>
    {open && <ul role="listbox" aria-label="Project" className="absolute left-0 top-full z-40 mt-1.5 max-h-64 w-60 overflow-y-auto rounded-xl border border-divider bg-surface-high p-1 shadow-2xl shadow-black/60">
      {options.map(option => {
        const active = option.id === selected.id;
        return <li key={option.id ?? 'none'} role="option" aria-selected={active}>
          <button type="button" onClick={() => choose(option.id)}
            className={'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ' + (active ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content')}>
            <FolderOpen className={'h-3.5 w-3.5 shrink-0 ' + (option.id ? 'text-content-secondary' : 'text-content-muted')} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {active && <Check className="h-3.5 w-3.5 shrink-0 text-link" aria-hidden="true" />}
          </button>
        </li>;
      })}
    </ul>}
  </div>;
}

function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + (minutes === 1 ? ' minute ago' : ' minutes ago');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

/**
 * What Chat shows before a conversation exists: a greeting, one message box and
 * the project the work belongs to. Nothing is saved until the first message is
 * sent, so opening Alpha or pressing New chat never leaves empty conversations.
 */
export function ChatHome({
  userName, projects, projectId, onProjectChange, message, onMessageChange, approvalMode, onApprovalModeChange,
  skills, selectedSkillIds, onSkillIdsChange, onImprovePrompt, onPromptError, onScanSkills, scanningSkills,
  onSend, canSend, blockedReason, recent, onOpenRecent
}: ChatHomeProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [skillCommandQuery, setSkillCommandQuery] = useState<ChatSkillCommandQuery | null>(null);
  const [activeSkillCommandIndex, setActiveSkillCommandIndex] = useState(0);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (!toolsMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => { if (!toolsMenuRef.current?.contains(event.target as Node)) setToolsMenuOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setToolsMenuOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [toolsMenuOpen]);
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight, 220) + 'px';
  }, [message]);
  const skillCommandSuggestions = useMemo(() => skillCommandQuery ? matchChatSkills(skills, skillCommandQuery.query) : [], [skillCommandQuery, skills]);
  const name = greetingName(userName);
  const ready = canSend && Boolean(message.trim());
  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (ready) { setSkillCommandQuery(null); onSend(); }
  };
  const updateHomeMessage = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onMessageChange(next);
    const query = getChatSkillCommandAtCursor(next, event.target.selectionStart ?? next.length);
    setSkillCommandQuery(query);
    if (query) setActiveSkillCommandIndex(0);
  };
  const insertSkillCommand = (skill: Skill) => {
    if (!skillCommandQuery || (!selectedSkillIds.includes(skill.id) && selectedSkillIds.length >= MAX_SELECTED_SKILLS)) return;
    onSkillIdsChange(selectedSkillIds.includes(skill.id) ? selectedSkillIds : [...selectedSkillIds, skill.id]);
    const before = message.slice(0, skillCommandQuery.start);
    let after = message.slice(skillCommandQuery.end);
    if (!before || before.endsWith(' ')) after = after.replace(/^\s+/, '');
    const next = before + after;
    onMessageChange(next);
    setSkillCommandQuery(null);
    setActiveSkillCommandIndex(0);
    const cursor = before.length;
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(cursor, cursor);
    });
  };
  const handleHomeInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (skillCommandQuery && skillCommandSuggestions.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSkillCommandIndex(index => (index + 1) % skillCommandSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSkillCommandIndex(index => (index - 1 + skillCommandSuggestions.length) % skillCommandSuggestions.length);
        return;
      }
      if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
        event.preventDefault();
        insertSkillCommand(skillCommandSuggestions[activeSkillCommandIndex] ?? skillCommandSuggestions[0]);
        return;
      }
    }
    if (event.key === 'Escape' && skillCommandQuery) {
      event.preventDefault();
      setSkillCommandQuery(null);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return <div className="flex h-full min-h-0 flex-col overflow-y-auto">
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-7 flex items-center justify-center gap-3">
        <img src={alphaMarkUrl} alt="" aria-hidden="true" className="h-11 w-11 rounded-xl bg-action object-contain" />
        <h1 className="text-3xl font-semibold tracking-tight text-content">{name ? 'Ready to code, ' + name + '?' : 'Ready to code?'}</h1>
      </div>

      <form onSubmit={submit} className="relative rounded-2xl border border-divider bg-surface-raised/95 p-3 shadow-2xl shadow-black/40 transition-colors focus-within:border-control">
        <ChatSkillCommandSuggestions id="chat-home-skill-command-suggestions" query={skillCommandQuery} skills={skills} selectedSkillIds={selectedSkillIds} activeIndex={activeSkillCommandIndex} onActiveIndexChange={setActiveSkillCommandIndex} onSelect={insertSkillCommand} onScan={onScanSkills} scanning={scanningSkills} className="left-0" />
        <label htmlFor="chat-home-message" className="sr-only">Message Alpha</label>
        <textarea
          id="chat-home-message"
          ref={inputRef}
          value={message}
          onChange={updateHomeMessage}
          onKeyDown={handleHomeInputKeyDown}
          aria-autocomplete="list"
          aria-expanded={Boolean(skillCommandQuery)}
          aria-controls={skillCommandQuery ? 'chat-home-skill-command-suggestions' : undefined}
          rows={2}
          placeholder="Ask Alpha anything · type / to call a skill…"
          className="max-h-56 min-h-14 w-full resize-none bg-transparent px-1.5 py-1 text-sm text-content placeholder-content-muted outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <div ref={toolsMenuRef} className="relative shrink-0">
            <button type="button" aria-label={`Open message tools${selectedSkillIds.length ? `; ${selectedSkillIds.length} skills selected` : ''}`} aria-haspopup="menu" aria-expanded={toolsMenuOpen} onClick={() => setToolsMenuOpen(value => !value)} className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${toolsMenuOpen ? 'bg-surface-high text-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}>
              <Plus className={`h-4 w-4 transition-transform ${toolsMenuOpen ? 'rotate-45' : ''}`} />
              {selectedSkillIds.length > 0 && <span aria-hidden="true" className="absolute bottom-0 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-action px-0.5 text-[8px] font-semibold leading-none text-on-action">{selectedSkillIds.length}</span>}
            </button>
            {toolsMenuOpen && <div role="menu" aria-label="Message tools" className="absolute bottom-full left-0 z-50 mb-3 max-h-[min(72vh,38rem)] w-[min(24rem,calc(100vw-2rem))] animate-slide-up overflow-y-auto rounded-2xl border border-divider bg-surface-high p-2 shadow-2xl shadow-black/60">
              <ChatSkillTools inline skills={skills} selectedSkillIds={selectedSkillIds} onSkillIdsChange={onSkillIdsChange}
                draft={message} onDraftChange={onMessageChange} onImprove={onImprovePrompt} onError={onPromptError}
                onScan={onScanSkills} scanning={scanningSkills} />
            </div>}
          </div>
          <ProjectPicker projects={projects} projectId={projectId} onChange={onProjectChange} />
          <label className="sr-only" htmlFor="chat-home-approval-mode">Model access</label>
          <span className="relative flex items-center">
            <select id="chat-home-approval-mode" aria-label="Model access" title="Choose how much access the selected model has for this chat" value={approvalMode} onChange={event => onApprovalModeChange(event.target.value as 'ask' | 'approve' | 'full')} className="max-w-40 cursor-pointer appearance-none rounded-md bg-transparent py-1.5 pl-2 pr-5 text-[11px] text-content-secondary outline-none hover:text-content focus-visible:text-content focus-visible:ring-2 focus-visible:ring-focus [&>option]:bg-surface-high [&>option]:text-content">
              <option value="ask">Ask for approval</option>
              <option value="approve">Approve for me</option>
              <option value="full">Full access</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 h-3 w-3 text-content-muted" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-content-muted">{blockedReason ?? (projectId ? 'Builds run in this project’s codebases.' : 'Not connected to a project. Pick one when you want Alpha to build.')}</span>
          <button type="submit" disabled={!ready} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-action text-on-action hover:bg-action-hover disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>

      {recent.length > 0 && <section aria-label="Recent chats" className="mt-8">
        <h2 className="mb-1.5 px-1 text-[11px] font-medium text-content-muted">Recent</h2>
        <ul className="divide-y divide-divider">
          {recent.map(thread => <li key={thread.id}>
            <button type="button" onClick={() => onOpenRecent(thread.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-content-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-content">{thread.title}</span>
                <span className="block truncate text-[10px] text-content-muted">{[thread.projectName, timeAgo(thread.lastMessageAt)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>}
    </div>
  </div>;
}

