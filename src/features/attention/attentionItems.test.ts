import { describe, expect, it } from 'vitest';
import type { IssueBuildStatus } from '@/shared/services/apiService';
import type { BoardAgentChange, Issue, Project } from '@/shared/types';
import type { PmClientSummary } from '@/features/ticketing/pmApi';
import { agentChangesAttention, buildAttention, clientAttention, inquiriesAttention, sortAttention } from './attentionItems';

const project = { id: 'p1', name: 'Clinic website' } as Project;
const issue = { id: 'i1', identifier: 'LUM-18', title: 'Online appointment calendar', projectId: 'p1' } as Issue;
const build = (status: string, extra: Partial<IssueBuildStatus> = {}): IssueBuildStatus =>
  ({ issueId: 'i1', projectId: 'p1', runId: 'r1', status, updatedAt: '2026-11-26T01:00:00Z', ...extra });

describe('what needs your attention', () => {
  it('turns a build into the step it is waiting on', () => {
    expect(buildAttention(build('awaiting_plan_approval'), issue, project)).toMatchObject({
      group: 'approve', title: 'Plan ready: Online appointment calendar', detail: 'Clinic website · LUM-18',
      target: { view: 'issues', projectId: 'p1', issueId: 'i1' } });
    expect(buildAttention(build('blocked'), issue, project)?.group).toBe('answer');
    expect(buildAttention(build('recovery_required'), issue, project)?.group).toBe('answer');
    expect(buildAttention(build('awaiting_approval'), issue, project)?.group).toBe('review');
    expect(buildAttention(build('awaiting_approval', { workspaceLost: true }), issue, project)?.group).toBe('answer');
    expect(buildAttention(build('executing'), issue, project)).toBeNull();
  });

  it('collects held agent board changes per project', () => {
    const change = (id: string, status: BoardAgentChange['status'], issueId?: string) =>
      ({ id, status, issueId, createdAt: '2026-11-26T0' + id + ':00:00Z' }) as BoardAgentChange;
    expect(agentChangesAttention([change('1', 'applied')], project)).toBeNull();
    const item = agentChangesAttention([change('2', 'held', 'i1'), change('1', 'held', 'i1'), change('3', 'applied')], project);
    expect(item).toMatchObject({ group: 'review', title: '2 board changes from agents are waiting for you', since: '2026-11-26T01:00:00Z',
      target: { view: 'issues', projectId: 'p1', issueId: 'i1' } });
    expect(agentChangesAttention([change('1', 'held', 'i1'), change('2', 'held', 'i2')], project)?.target).toEqual({ view: 'issues', projectId: 'p1' });
  });

  it('lists a client only when they are waiting on the project manager', () => {
    const client = (needsPm: number, unreadReplies = 0) => ({ key: 'client:1', displayName: 'Lumen Dental', lastActivityAt: '2026-11-26T00:00:00Z',
      tickets: { needsPm, unreadReplies, waitingClient: 0, open: 1, closed: 0, unlinkedOpen: 0, accessRevoked: 0 } }) as unknown as PmClientSummary;
    expect(clientAttention(client(0))).toBeNull();
    expect(clientAttention(client(2, 1))).toMatchObject({ group: 'answer', title: 'Lumen Dental is waiting on you',
      detail: '2 requests need you · 1 unread reply', target: { view: 'clients', clientKey: 'client:1' } });
  });

  it('counts new inquiries, and says when there are more than one page', () => {
    expect(inquiriesAttention(0, false)).toBeNull();
    expect(inquiriesAttention(1, false)?.title).toBe('1 new inquiry to answer');
    expect(inquiriesAttention(50, true)?.title).toBe('50+ new inquiries to answer');
  });

  it('puts the longest wait first', () => {
    const a = buildAttention(build('blocked', { updatedAt: '2026-11-26T03:00:00Z' }), issue, project)!;
    const b = inquiriesAttention(1, false, '2026-11-25T03:00:00Z')!;
    expect(sortAttention([a, b]).map(item => item.id)).toEqual([b.id, a.id]);
  });
});

