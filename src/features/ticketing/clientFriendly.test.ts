import { describe, expect, it } from 'vitest';
import type { ClientProjectRequestItem } from './clientApi';
import { clientGreeting, clientNextLine, clientNextStep, clientRequestGroup, clientWhatNext, dayLabel, listProgressIndex, projectProgress, relativeTime } from './clientFriendly';

const item = (overrides: Partial<ClientProjectRequestItem>): ClientProjectRequestItem => ({
  id: 'r1', reference: 'REF-1', title: 'Request', status: 'in_progress', createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z', closedAt: null, readOnly: false, writesAvailable: true, requestedAction: null,
  workspaceId: 'w1', projectId: 'p1', projectName: 'Project', projectLinkStatus: 'linked', ...overrides,
} as ClientProjectRequestItem);

describe('client friendly helpers', () => {
  it('groups requests by what the client needs to do', () => {
    expect(clientRequestGroup(item({ requestedAction: 'reply', status: 'awaiting_client' }))).toBe('needs_you');
    expect(clientRequestGroup(item({}))).toBe('in_progress');
    expect(clientRequestGroup(item({ status: 'closed', requestedAction: 'reply' }))).toBe('done');
    expect(clientRequestGroup(item({ status: 'declined' }))).toBe('done');
  });

  it('names the next step in plain words', () => {
    expect(clientNextStep('agree_scope')).toEqual({ prompt: 'A plan is ready for you to approve', action: 'Review plan' });
    expect(clientNextStep('review_result')?.action).toBe('Check the result');
    expect(clientNextStep(null)).toBeNull();
  });

  it('greets by time of day', () => {
    expect(clientGreeting(new Date(2026, 10, 15, 9))).toBe('Good morning');
    expect(clientGreeting(new Date(2026, 10, 15, 14))).toBe('Good afternoon');
    expect(clientGreeting(new Date(2026, 10, 15, 20))).toBe('Good evening');
  });

  it('describes times relative to now', () => {
    const now = Date.parse('2026-11-15T12:00:00Z');
    expect(relativeTime('2026-11-15T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-11-15T11:55:00Z', now)).toBe('5 minutes ago');
    expect(relativeTime('2026-11-15T10:00:00Z', now)).toBe('2 hours ago');
    expect(relativeTime('2026-11-14T10:00:00Z', now)).toBe('yesterday');
    expect(relativeTime('2026-11-11T12:00:00Z', now)).toBe('4 days ago');
    expect(relativeTime('not a date', now)).toBe('');
  });

  it('places a listed request on the five steps only when the row can tell', () => {
    expect(listProgressIndex(item({ status: 'received' }))).toBe(0);
    expect(listProgressIndex(item({ status: 'awaiting_client', requestedAction: 'agree_scope' }))).toBe(1);
    expect(listProgressIndex(item({ status: 'in_progress' }))).toBe(2);
    expect(listProgressIndex(item({ status: 'ready_for_review', requestedAction: 'review_result' }))).toBe(3);
    expect(listProgressIndex(item({ status: 'awaiting_client', requestedAction: 'reply' }))).toBeNull();
    expect(listProgressIndex(item({ status: 'on_hold' }))).toBeNull();
    expect(listProgressIndex(item({ status: 'closed' }))).toBeNull();
  });

  it('labels timeline days', () => {
    const now = new Date(2026, 10, 15, 12).getTime();
    expect(dayLabel(new Date(2026, 10, 15, 8).toISOString(), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 14, 23).toISOString(), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 2, 9).toISOString(), now)).not.toMatch(/Today|Yesterday/);
  });

  it('says what happens next for a listed request, and nothing once it has ended', () => {
    expect(clientNextLine(item({ status: 'awaiting_client', requestedAction: 'agree_scope' }))).toBe('approve the plan so the work can start');
    expect(clientNextLine(item({ status: 'in_progress' }))).toBe('your project manager shares the result');
    expect(clientNextLine(item({ status: 'received', projectLinkStatus: 'pending_review' }))).toMatch(/confirms which project/);
    expect(clientNextLine(item({ status: 'closed', requestedAction: 'reply' }))).toBeNull();
  });

  it('explains what follows the current step on a request page', () => {
    expect(clientWhatNext({ status: 'awaiting_client', requestedAction: 'agree_scope' })).toMatch(/^Once you approve/);
    expect(clientWhatNext({ status: 'ready_for_review', requestedAction: 'review_result' })).toMatch(/If you accept, the request is finished/);
    expect(clientWhatNext({ status: 'in_progress', requestedAction: null })).toMatch(/shares the result here/);
    expect(clientWhatNext({ status: 'cancelled', requestedAction: null })).toBeNull();
  });

  it('averages how far a project\'s requests are along, leaving out ended and unplaceable ones', () => {
    expect(projectProgress([item({ status: 'closed' }), item({ status: 'in_progress' })])).toBe(75);
    expect(projectProgress([item({ status: 'received' }), item({ status: 'cancelled' }), item({ status: 'on_hold' })])).toBe(0);
    expect(projectProgress([item({ status: 'declined' })])).toBeNull();
  });
});
