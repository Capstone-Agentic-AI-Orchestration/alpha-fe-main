import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { nextActionLine, parseStageBadge, parseStageResult, parseStageSummary, revisionAllowance, stageEventLine, stageSteps,
  type StageSummary } from './projectStages';
import { parseConversation, conversationChatMessages } from './projectConversation';
import { ProjectStageTracker } from './ProjectStageTracker';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import type { ClientProject } from './clientApi';

const poc = {
  id: 'poc-1', number: 2, status: 'published', title: 'Booking site', summary: 'Customers book a table.',
  features: [{ title: 'Online booking', detail: 'Pick a date' }], screens: ['Home', 'Booking'], outOfScope: 'Payments', note: '',
  contentHash: 'a'.repeat(64), createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', publishedAt: '2026-11-20T10:00:00Z',
  approvedAt: null, approvedName: null, changeRequest: null,
};
const raw = {
  stage: 'poc', stageLabel: 'Proof of concept', revisionLimit: 3, revisionsUsed: 0, version: 4, stageChangedAt: '2026-11-20T10:00:00Z',
  nextAction: { who: 'client', kind: 'review_poc', label: 'Review POC v2' },
  poc, pocDraft: null, pocHistory: [{ id: 'poc-1', number: 2, status: 'published', publishedAt: '2026-11-20T10:00:00Z' }],
  contract: null, rounds: [], requests: [], final: null,
};
const summary = (patch: Partial<StageSummary> = {}): StageSummary => ({ ...parseStageSummary(raw), ...patch });
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };

describe('project stage model', () => {
  it('reads a stage summary strictly', () => {
    const value = parseStageSummary(raw);
    expect(value.poc?.features).toEqual([{ title: 'Online booking', detail: 'Pick a date' }]);
    expect('clientId' in value).toBe(false);
    expect(parseStageSummary({ ...raw, clientId: 'client-a' }).clientId).toBe('client-a');
    expect(() => parseStageSummary({ ...raw, stage: 'launch' })).toThrow();
    expect(() => parseStageSummary({ ...raw, poc: { ...poc, features: 'many' } })).toThrow();
    expect(() => parseStageSummary({ ...raw, nextAction: { who: 'someone', kind: 'review_poc', label: '' } })).toThrow();
    expect(parseStageResult({ receipt: { operationId: 'op', action: 'poc_approved', refId: 'poc-1', version: 5 }, stage: raw }).receipt.version).toBe(5);
    expect(parseStageBadge({ stage: 'poc', label: 'Proof of concept', waitingOn: 'pm', actionLabel: null })).toMatchObject({ stage: 'poc' });
    expect(parseStageBadge({ stage: 'nope' })).toBeNull();
  });

  it('names the steps, the allowance and whose turn it is', () => {
    expect(stageSteps('contract').map(step => step.state)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(stageSteps('completed').map(step => step.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(stageSteps('unset').every(step => step.state === 'upcoming')).toBe(true);
    expect(revisionAllowance({ stage: 'poc', revisionLimit: 3, revisionsUsed: 0 })).toBe('Unlimited changes');
    expect(revisionAllowance({ stage: 'development', revisionLimit: 3, revisionsUsed: 4 })).toBe('Revisions: 3 of 3 used · 1 extra');
    expect(revisionAllowance({ stage: 'contract', revisionLimit: 3, revisionsUsed: 0 })).toBeNull();
    expect(nextActionLine(summary(), 'client')).toEqual({ mine: true, text: 'Review POC v2' });
    expect(nextActionLine(summary(), 'pm')).toEqual({ mine: false, text: 'Waiting for the client' });
  });

  it('tells each side what happened, from their side', () => {
    const event = { action: 'poc_approved', refId: 'poc-1', number: 2, name: 'Juan Dela Cruz', stage: null };
    expect(stageEventLine(event, 'client', 'client')).toBe('You approved POC v2 (signed as Juan Dela Cruz) · Next: the contract');
    expect(stageEventLine(event, 'client', 'pm')).toBe('The client approved POC v2 (signed as Juan Dela Cruz) · Next: the contract');
    expect(stageEventLine({ ...event, action: 'poc_published', name: null }, 'pm', 'client')).toBe('Your project manager shared POC v2 for review');
  });

  it('shows stage events in the conversation: a line, or the client’s words for a change request', () => {
    const { items } = parseConversation({ items: [
      { id: 'se:1', kind: 'stage_event', author: 'pm', body: '', createdAt: '2026-11-20T10:00:00Z', request: null, task: null,
        stage: { action: 'poc_published', refId: 'poc-1', number: 1, name: null, stage: null } },
      { id: 'se:2', kind: 'stage_event', author: 'client', body: 'Add a menu page', createdAt: '2026-11-20T11:00:00Z', request: null, task: null,
        stage: { action: 'poc_changes_requested', refId: 'poc-1', number: 1, name: null, stage: null } },
    ] });
    const messages = conversationChatMessages(items, 'client');
    expect(messages[0]).toMatchObject({ kind: 'event', body: 'Your project manager shared POC v1 for review' });
    expect(messages[1]).toMatchObject({ author: 'client', body: 'Add a menu page', tag: 'You asked for changes to POC v1' });
    expect(() => parseConversation({ items: [{ ...items[0], stage: null }] })).toThrow();
  });
});

describe('stage UI', () => {
  it('shows the tracker with the current step and the reader’s turn', () => {
    const html = renderToStaticMarkup(<ProjectStageTracker summary={summary()} role="client" />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Proof of concept');
    expect(html).toContain('Unlimited changes');
    expect(html).toContain('Your turn: Review POC v2');
    expect(renderToStaticMarkup(<ProjectStageTracker summary={summary({ stage: 'development', revisionsUsed: 1 })} role="pm" />))
      .toContain('Revisions: 1 of 3 used');
  });

  it('lets the client review, approve or ask for changes to the shared POC', () => {
    const props = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
    const html = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary()} />);
    expect(html).toContain('Booking site');
    expect(html).toContain('Approve this POC');
    expect(html).toContain('Request changes');
    const readOnly = renderToStaticMarkup(<ClientStagePanel {...props} readOnly summary={summary()} />);
    expect(readOnly).not.toContain('Approve this POC');
    const preparing = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ poc: null })} />);
    expect(preparing).toContain('preparing the proof of concept');
    const approved = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ stage: 'contract',
      poc: { ...summary().poc!, status: 'approved', approvedName: 'Juan', approvedAt: '2026-11-21T10:00:00Z' } })} />);
    expect(approved).toContain('POC v2 approved by Juan');
    expect(approved).toContain('preparing the contract');
  });

  it('gives the PM the starting-stage choice, the POC editor and the change request to answer', () => {
    const props = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ stage: 'unset', poc: null })} />)).toContain('Where is this project now?');
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ poc: null })} />)).toContain('Write the POC');
    const asked = renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ poc: { ...summary().poc!, status: 'changes_requested',
      changeRequest: { body: 'Add a menu page', createdAt: '2026-11-21T10:00:00Z' } } })} />);
    expect(asked).toContain('The client asked for changes to v2.');
    expect(asked).toContain('Add a menu page');
    expect(asked).toContain('Write v3');
    const drafting = renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ pocDraft: { ...summary().poc!, id: 'd', number: 3, status: 'draft', publishedAt: null } })} />);
    expect(drafting).toContain('Draft v3');
    expect(drafting).toContain('Share with the client');
  });
});
