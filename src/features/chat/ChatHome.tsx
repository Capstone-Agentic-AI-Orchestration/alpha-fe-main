import React, { useEffect, useRef } from 'react';
import { ArrowUp, FolderOpen, MessageSquare } from 'lucide-react';

import alphaMarkUrl from '@/assets/alpha-mark.png';

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
  userName, projects, projectId, onProjectChange, message, onMessageChange, onSend, canSend, blockedReason, recent, onOpenRecent
}: ChatHomeProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight, 220) + 'px';
  }, [message]);
  const name = greetingName(userName);
  const ready = canSend && Boolean(message.trim());
  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (ready) onSend();
  };

  return <div className="flex h-full min-h-0 flex-col overflow-y-auto">
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-7 flex items-center justify-center gap-3">
        <img src={alphaMarkUrl} alt="" aria-hidden="true" className="h-11 w-11 rounded-xl object-contain" />
        <h1 className="text-3xl font-semibold tracking-tight text-white">{name ? 'Ready to code, ' + name + '?' : 'Ready to code?'}</h1>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-surface-100/95 p-3 shadow-2xl shadow-black/40 transition-colors focus-within:border-brand-400/40">
        <label htmlFor="chat-home-message" className="sr-only">Message Alpha</label>
        <textarea
          id="chat-home-message"
          ref={inputRef}
          value={message}
          onChange={event => onMessageChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
          rows={2}
          placeholder="Ask Alpha anything or describe what to build…"
          className="max-h-56 min-h-14 w-full resize-none bg-transparent px-1.5 py-1 text-sm text-white placeholder-gray-500 outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[11px] text-gray-300 focus-within:border-brand-400/40">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
            <span className="sr-only">Project</span>
            <select value={projectId ?? ''} onChange={event => onProjectChange(event.target.value || null)} className="min-w-0 max-w-56 truncate bg-transparent text-[11px] text-gray-200 outline-none">
              <option value="">No project</option>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <span className="min-w-0 flex-1 truncate text-[10px] text-gray-500">{blockedReason ?? (projectId ? 'Builds run in this project’s codebases.' : 'Pick a project when you want Alpha to build.')}</span>
          <button type="submit" disabled={!ready} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-on-accent hover:bg-brand-400 disabled:opacity-30">
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </form>

      {recent.length > 0 && <section aria-label="Recent chats" className="mt-8">
        <h2 className="mb-1.5 px-1 text-[11px] font-medium text-gray-500">Recent</h2>
        <ul className="divide-y divide-white/[0.06]">
          {recent.map(thread => <li key={thread.id}>
            <button type="button" onClick={() => onOpenRecent(thread.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-gray-200">{thread.title}</span>
                <span className="block truncate text-[10px] text-gray-500">{[thread.projectName, timeAgo(thread.lastMessageAt)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          </li>)}
        </ul>
      </section>}
    </div>
  </div>;
}

