import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ListPlus, Play, Send, Sparkles } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { ChatSidePanel } from '@/features/chat/ChatSidePanel';
import { MessageMarkdown } from '@/features/chat/MessageMarkdown';
import { apiService } from '@/shared/services/apiService';
import type { BoardAgentChange, ChatMessage, Issue, IssueStatus, SystemProposal } from '@/shared/types';
import { isBoardThreadId } from './useTaskBuild';
import { AgentChangesList } from '@/features/board-agent/AgentChangesList';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';
import { Textarea } from '@/shared/components/ui/textarea';

/** Separates what the person typed from the board context sent with it. */
export const SCOPE_MARKER = '\n\n[Board scope]\n';
/** Enough tasks to talk about, few enough to keep each request small. */
export const MAX_SCOPE_TASKS = 20;
const MAX_ASK_CHARS = 5_800;
const MAX_DRAFT_CHARS = 4_000;

/** Saved task context, bounded per description and per request. */
export function scopeLines(tasks: Issue[], columnTitle: (issue: Issue) => string): string {
  return tasks.slice(0, MAX_SCOPE_TASKS).map(issue => {
    const open = (issue.subtasks ?? []).filter(item => !item.completed).map(item => item.title);
    const description = (issue.description ?? '').trim().replace(/\s+/g, ' ');
    const details = description ? ' | Details: ' + description.slice(0, 1_600) + (description.length > 1_600 ? ' [description shortened]' : '') : '';
    return '- ' + issue.identifier + ' [' + columnTitle(issue) + '] ' + issue.title + (open.length ? ' (checklist: ' + open.join('; ') + ')' : '') + details;
  }).join('\n');
}

/** The part of a sent message the person wrote, without the attached scope. */
export const visibleText = (content: string) => content.split(SCOPE_MARKER)[0];

/**
 * An Ask Alpha question. The ids let the Orchestrator read each selected
 * task's build records; the scope text carries descriptions and checklists.
 */
export const askRequest = (threadId: string, projectId: string, text: string, tasks: Issue[], scopeText: string) => ({
  threadId,
  projectId,
  content: scopeText ? text + SCOPE_MARKER + scopeText : text,
  intent: 'ask' as const,
  scopeIssueIds: tasks.map(issue => issue.id)
});

interface BoardAlphaPanelProps {
  projectId: string;
  projectKey?: string;
  /** The project's tasks, in board order. */
  issues: Issue[];
  columns: { id: IssueStatus; title: string }[];
  columnFor: (issue: Issue) => IssueStatus;
  /** Whether this person can start a build on the task from here. */
  canStartBuild: (issue: Issue) => boolean;
  onStartBuild: (issue: Issue) => void;
  onOpenIssue: (issueId: string) => void;
  onClose: () => void;
  /** Told when the Manager Agent starts and stops working, so the board reads its changes sooner. */
  onWorkingChange?: (working: boolean) => void;
  /** Agent changes waiting for this developer to confirm. */
  waiting?: BoardAgentChange[];
  login?: string;
  decidingId?: string | null;
  onDecide?: (id: string, action: 'approve' | 'reject' | 'undo') => void;
}

/**
 * A developer's Alpha panel beside the board.
 *
 * The person picks the columns, and the tasks in them, that Alpha should look
 * at. The Manager Agent answers about them and changes cards when asked, as
 * this developer; archiving and large changes wait here for confirmation. It
 * never starts a build. Suggest tasks drafts new tasks; nothing is added until
 * the person keeps them. Builds start one task at a time through the board's
 * own confirmation, so the orchestration is unchanged.
 */
export const BoardAlphaPanel: React.FC<BoardAlphaPanelProps> = ({
  projectId, projectKey, issues, columns, columnFor, canStartBuild, onStartBuild, onOpenIssue, onClose,
  onWorkingChange, waiting = [], login, decidingId, onDecide
}) => {
  const { createIssue } = useApp();
  const [scopeColumns, setScopeColumns] = useState<Set<IssueStatus>>(() => new Set<IssueStatus>(['todo']));
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'ask' | 'draft' | null>(null);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<SystemProposal | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);

  const titleOf = (status: IssueStatus) => columns.find(column => column.id === status)?.title ?? status;
  const columnTasks = useMemo(() => issues.filter(issue => scopeColumns.has(columnFor(issue))), [issues, scopeColumns, columnFor]);
  const inScope = columnTasks.filter(issue => !excluded.has(issue.id)).slice(0, MAX_SCOPE_TASKS);
  const scopeText = scopeLines(inScope, issue => titleOf(columnFor(issue)));

  // The project's private ask conversation, and what was said in it before.
  useEffect(() => {
    let cancelled = false;
    setThreadId(null); setMessages([]); setProposal(null); setNotes([]); setError('');
    apiService.getBoardThread(projectId)
      .then(async thread => {
        if (cancelled || !isBoardThreadId(thread.id)) return;
        setThreadId(thread.id);
        const history = await apiService.getChatMessages(thread.id);
        if (!cancelled) setMessages(history.filter(message => message.senderType !== 'system'));
      })
      .catch(failure => { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Alpha could not open this conversation.'); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length, proposal, notes.length, busy]);

  const toggleColumn = (status: IssueStatus) => setScopeColumns(current => {
    const next = new Set(current);
    if (next.has(status)) next.delete(status); else next.add(status);
    return next;
  });
  const toggleTask = (issueId: string) => setExcluded(current => {
    const next = new Set(current);
    if (next.has(issueId)) next.delete(issueId); else next.add(issueId);
    return next;
  });

  const ask = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy('ask'); setError('');
    onWorkingChange?.(true);
    try {
      if ((scopeText ? text + SCOPE_MARKER + scopeText : text).length > MAX_ASK_CHARS) throw new Error('The selected task context is too large. Select fewer tasks or shorten your message.');
      const id = threadId ?? (await apiService.getBoardThread(projectId)).id;
      if (!isBoardThreadId(id)) throw new Error('Alpha could not open this conversation.');
      setThreadId(id);
      const request = askRequest(id, projectId, text, inScope, scopeText);
      setMessages(current => [...current, { id: 'pending-' + Date.now(), senderType: 'user', senderName: 'You', content: request.content, timestamp: new Date().toISOString() }]);
      setInput('');
      await apiService.sendChatMessage({ ...request, clientMessageId: 'msg-' + Date.now() + '-' + crypto.randomUUID() });
      const history = await apiService.getChatMessages(id);
      setMessages(history.filter(message => message.senderType !== 'system'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your question was not sent.');
    } finally {
      setBusy(null);
      onWorkingChange?.(false);
    }
  };

  const suggest = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy('draft'); setError(''); setProposal(null);
    try {
      const existing = scopeText ? '\n\nAlready on the board, so do not repeat these:\n' + scopeText : '';
      if ((text + existing).length > MAX_DRAFT_CHARS) throw new Error('The selected task context is too large. Select fewer tasks or shorten your message.');
      const next = await apiService.proposeSystemEpics(projectId, text + existing);
      setProposal(next);
      setKept(new Set(next.epics.map((_epic, index) => index)));
      setInput('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Alpha could not suggest tasks.');
    } finally {
      setBusy(null);
    }
  };

  const addKept = () => {
    if (!proposal) return;
    let added = 0;
    proposal.epics.forEach((epic, index) => {
      if (!kept.has(index)) return;
      const created = createIssue({
        title: epic.title,
        description: epic.outcome + (epic.personas.length ? '\n\nFor: ' + epic.personas.join(', ') : ''),
        projectId, priority: 'medium', status: 'backlog', labels: []
      });
      if (created) added += 1;
    });
    setProposal(null);
    if (added) setNotes(current => [...current, 'Added ' + added + (added === 1 ? ' task' : ' tasks') + ' to Backlog.']);
  };

  const close = () => { if (!busy) onClose(); };

  return (
    <ChatSidePanel
      tabs={[{ id: 'alpha', title: 'Alpha' + (projectKey ? ' · ' + projectKey : ''), icon: <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />, live: Boolean(busy) }]}
      activeId="alpha"
      onSelect={() => undefined}
      onClose={close}
      onCloseAll={close}
      widthStorageKey="alpha.boardAlphaPanelWidth.v2"
      defaultWidth={560}
    >
      <section aria-label="What Alpha looks at" className="shrink-0 space-y-2 border-b border-divider p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold text-content-secondary">Work on</h2>
          <span className="text-[11.5px] text-content-muted">{inScope.length} {inScope.length === 1 ? 'task' : 'tasks'}</span>
        </div>
        <div role="group" aria-label="Columns" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {columns.map(column => {
            const on = scopeColumns.has(column.id);
            return (
              <Button key={column.id} type="button" size="sm" variant={on ? 'default' : 'outline'} aria-pressed={on} onClick={() => toggleColumn(column.id)}
                className="h-7 shrink-0 px-2.5 text-[11.5px]">
                {column.title}
              </Button>
            );
          })}
        </div>
        {columnTasks.length > 0 ? (
          <ul className="max-h-40 space-y-0.5 overflow-y-auto">
            {columnTasks.map(issue => (
              <li key={issue.id} className="flex min-h-9 items-center gap-2 rounded-md px-1.5 hover:bg-surface-high">
                <input type="checkbox" aria-label={'Include ' + issue.identifier} checked={inScope.some(item => item.id === issue.id)}
                  disabled={!inScope.some(item => item.id === issue.id) && inScope.length >= MAX_SCOPE_TASKS}
                  onChange={() => toggleTask(issue.id)} className="h-4 w-4 shrink-0 accent-brand-500 disabled:opacity-40" />
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenIssue(issue.id)} className="h-auto min-w-0 flex-1 justify-start gap-2 px-0 py-1 text-left text-[12.5px]">
                  <Badge variant="outline" className="shrink-0 border-brand-400/25 bg-brand-400/10 px-1.5 py-0 font-mono text-[10px] leading-5 text-brand-200">{issue.identifier}</Badge>
                  <span className="truncate">{issue.title}</span>
                </Button>
                {canStartBuild(issue) && (
                  <Button type="button" size="sm" onClick={() => onStartBuild(issue)} title={'Start a build for ' + issue.identifier}
                    className="h-6 shrink-0 gap-1 px-2 text-[11px]">
                    <Play aria-hidden="true" className="h-3 w-3" /> Build
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-content-muted">{scopeColumns.size ? 'No tasks in these columns.' : 'Pick a column. With none picked, Alpha answers about the project as a whole.'}</p>
        )}
        {columnTasks.length > MAX_SCOPE_TASKS && <p className="text-[11.5px] text-content-muted">Up to {MAX_SCOPE_TASKS} tasks are included. Untick a task to include the next one.</p>}
      </section>

      <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && !proposal && !busy && (
          <p className="text-[12.5px] leading-relaxed text-content-muted">Ask about the tasks you picked, or ask the Manager Agent to create, edit, move or archive cards. It acts as you; archiving and changes to many cards wait for you to confirm. Alpha never changes code from here; start a build from a task.</p>
        )}
        {messages.map(message => message.senderType === 'user' ? (
          <div key={message.id} className="flex justify-end">
            <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-surface-raised px-3 py-2 text-[13px] text-content">{visibleText(message.content)}</p>
          </div>
        ) : (
          <div key={message.id} className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-400/20 bg-brand-400/10 text-brand-200" aria-hidden="true">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              {message.senderName && <p className="mb-1 text-[11.5px] font-semibold text-content-secondary">{message.senderName}</p>}
              <Card className="break-words border-divider bg-surface/50 p-3 text-[13px]">
                <MessageMarkdown content={message.content} />
              </Card>
            </div>
          </div>
        ))}
        {busy === 'ask' && <p role="status" className="text-[12.5px] text-content-muted">The Manager Agent is working on your board.</p>}
        {waiting.length > 0 && (
          <section aria-label="Waiting for you" className="rounded-lg border border-status-warning-border">
            <p className="px-3 pt-2 text-[12px] font-semibold text-status-warning">Waiting for you to confirm</p>
            <AgentChangesList changes={waiting} login={login} busyId={decidingId} onDecide={onDecide} onOpenIssue={onOpenIssue} />
          </section>
        )}
        {busy === 'draft' && <p role="status" className="text-[12.5px] text-content-muted">Drafting task suggestions. Review them before adding them to Backlog.</p>}
        {proposal && (
          <div className="space-y-2 rounded-lg border border-divider p-2.5">
            <p className="text-[12px] font-semibold text-content-secondary">Suggested tasks</p>
            <ul className="space-y-1.5">
              {proposal.epics.map((epic, index) => (
                <li key={epic.title + index}>
                  <label className="flex gap-2.5 rounded-md border border-divider p-2">
                    <input aria-label={`Include ${epic.title}`} type="checkbox" checked={kept.has(index)} onChange={() => setKept(current => {
                      const next = new Set(current);
                      if (next.has(index)) next.delete(index); else next.add(index);
                      return next;
                    })} className="mt-0.5 h-3.5 w-3.5 accent-brand-500" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-content">{epic.title}</span>
                      <span className="block text-[12px] text-content-secondary">{epic.outcome}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setProposal(null)}>Discard</Button>
              <Button type="button" size="sm" disabled={!kept.size} onClick={addKept}>Add {kept.size} to Backlog</Button>
            </div>
          </div>
        )}
        {notes.map((note, index) => <p key={index} role="status" className="text-[12px] text-status-success">{note}</p>)}
        <div ref={endRef} />
      </div>

      <form className="shrink-0 space-y-2 border-t border-divider p-3" onSubmit={event => { event.preventDefault(); void ask(); }}>
        {error && <p role="alert" className="text-[12.5px] text-status-danger">{error}</p>}
        <label htmlFor="board-alpha-input" className="sr-only">Message Alpha</label>
        <Textarea id="board-alpha-input" rows={3} value={input} maxLength={3_000} onChange={event => setInput(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }}
          placeholder="Ask about these tasks, or describe work to split into tasks"
          className="min-h-[4.5rem] max-h-40 resize-none text-[13px] leading-5" />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!input.trim() || Boolean(busy)} onClick={() => void suggest()}>
            <ListPlus aria-hidden="true" className="h-3.5 w-3.5" /> Suggest tasks
          </Button>
          <Button type="submit" size="sm" disabled={!input.trim() || Boolean(busy)}>
            <Send aria-hidden="true" className="h-3.5 w-3.5" /> Ask
          </Button>
        </div>
      </form>
    </ChatSidePanel>
  );
};
