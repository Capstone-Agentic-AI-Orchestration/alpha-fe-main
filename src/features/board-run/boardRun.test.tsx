import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Issue } from '@/shared/types';
import type { BoardRun } from '@/shared/types/boardRun';
import { BoardRunBanner } from './BoardRunBanner';
import { BoardRunCard } from './BoardRunCard';
import { StartBoardRunDialog } from './StartBoardRunDialog';
import { asksForBoardRun, dependencyNote, runAnchorId, runCandidates, runSpend } from './boardRunPresentation';

const issue = (id: string, priority: Issue['priority'], status: Issue['status'] = 'todo', over: Partial<Issue> = {}) => ({
  id, identifier: id.toUpperCase(), title: `Task ${id}`, description: '', status, priority, projectId: 'p',
  labels: [], subtasks: [], comments: [], createdAt: '', updatedAt: '', ...over
}) as Issue;

const run = (over: Partial<BoardRun> = {}): BoardRun => ({
  id: 'r', workspaceId: 'w', ownerId: 'lloyd', projectId: 'p', threadId: 'chat-1', status: 'running',
  maxTasks: 5, maxTokens: 200000, maxCostUsd: 5, preApprovePlans: true,
  usage: { tokens: 12300, costUsd: 0.84, unmeasuredBuilds: 0 }, events: [], createdAt: '2026-11-20T10:00:00Z', updatedAt: '',
  tasks: [
    { issueId: 'a', identifier: 'PRO-102', title: 'Storage layer', priority: 'high', state: 'done', orchestrationRunId: 'run-a' },
    { issueId: 'b', identifier: 'PRO-103', title: 'Expense model', priority: 'high', state: 'waiting_on_you', orchestrationRunId: 'run-b' },
    { issueId: 'c', identifier: 'PRO-105', title: 'Filters', priority: 'medium', state: 'queued' }
  ],
  ...over
});

describe('choosing a run', () => {
  it('offers open tasks highest priority first, with To-do ones ticked', () => {
    const list = runCandidates([issue('low', 'low'), issue('done', 'urgent', 'done'), issue('high', 'high'), issue('later', 'medium', 'backlog')], 'p');
    expect(list.map(item => item.issue.id)).toEqual(['high', 'later', 'low']);
    expect(list.map(item => item.preselected)).toEqual([true, false, true]);
  });

  it('notes what a task waits on, until that is done', () => {
    const all = [issue('a', 'high'), issue('b', 'high', 'todo', { dependsOnIssueIds: ['a'] })];
    expect(dependencyNote(all[1], all)).toBe('after A');
    expect(dependencyNote(all[1], [{ ...all[0], status: 'done' }, all[1]])).toBeNull();
  });

  it('recognises a request to work through the board, and only that', () => {
    expect(asksForBoardRun('can you work through the board for me')).toBe(true);
    expect(asksForBoardRun('go through the backlog one by one')).toBe(true);
    expect(asksForBoardRun('start a board run')).toBe(true);
    expect(asksForBoardRun('what is the highest priority task')).toBe(false);
  });

  it('shows the start dialog with the tasks ticked, the limits, plan approval and the rules', () => {
    const html = renderToStaticMarkup(<StartBoardRunDialog open onClose={() => undefined} projectId="p" threadId="chat-1"
      issues={[issue('a', 'high'), issue('b', 'low', 'backlog')]} onStarted={() => undefined} />);
    expect(html).toContain('Start board run');
    expect(html).toContain('Task a');
    expect(html).toContain('Token limit');
    expect(html).toContain('Cost limit (USD)');
    expect(html).toContain('Approve the plans for these tasks now');
    expect(html).toContain('You still approve every pull request');
    expect(html).toContain('Agents never merge or mark a task done');
    expect(html).toContain('Start run (1 tasks)');
  });
});

describe('a run in the chat', () => {
  it('sits under the message sent just before it started', () => {
    const messages = [{ id: 'm1', timestamp: '2026-11-20T09:59:00Z' }, { id: 'm2', timestamp: '2026-11-20T10:05:00Z' }];
    expect(runAnchorId(messages, '2026-11-20T10:00:00Z')).toBe('m1');
    expect(runAnchorId(messages, '2026-11-20T09:00:00Z')).toBeNull();
  });

  it('shows each task, what it waits on, spend against limits and the controls', () => {
    const html = renderToStaticMarkup(<BoardRunCard run={run({ status: 'waiting_on_you', reason: 'PRO-103 is ready for your review.' })}
      onChange={() => undefined} onOpenBuild={() => undefined} />);
    expect(html).toContain('Board run · Waiting for you');
    expect(html).toContain('Started by lloyd');
    expect(html).toContain('PRO-103 is ready for your review.');
    expect(html).toContain('Done · PR opened');
    expect(html).toContain('Waiting for your approval');
    expect(html).toContain('Next');
    expect(html).toContain('Pause');
    expect(html).toContain('Stop run');
    expect(html).toContain('Every pull request waits for your approval');
    expect(runSpend(run())).toBe('spent 12,300 of 200,000 tokens · $0.84 of $5.00');
  });

  it('offers Resume when paused, says what usage it cannot count, and has no controls once over', () => {
    const paused = renderToStaticMarkup(<BoardRunCard run={run({ status: 'paused', usage: { tokens: 0, costUsd: 0, unmeasuredBuilds: 2 } })} onChange={() => undefined} />);
    expect(paused).toContain('Resume');
    expect(paused).toContain('2 builds have no reported usage');
    const over = renderToStaticMarkup(<BoardRunCard run={run({ status: 'completed' })} onChange={() => undefined} />);
    expect(over).toContain('Board run · Finished');
    expect(over).not.toContain('Stop run');
  });

  it('shows on the board with a way back to the chat, and nothing without a run', () => {
    const html = renderToStaticMarkup(<BoardRunBanner run={run({ status: 'waiting_on_you', reason: 'PRO-103 is ready for your review.' })} onOpenChat={() => undefined} />);
    expect(html).toContain('Board run in chat · Waiting for you · 1 of 3 done');
    expect(html).toContain('Open chat');
    expect(renderToStaticMarkup(<BoardRunBanner run={null} onOpenChat={() => undefined} />)).toBe('');
  });
});
