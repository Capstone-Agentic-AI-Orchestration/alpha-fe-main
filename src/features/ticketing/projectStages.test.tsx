import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { nextActionLine, parseStageBadge, parseStageResult, parseStageSummary, revisionAllowance, stageEventLine, stageSteps,
  type StageSummary } from './projectStages';
import { parseConversation, conversationChatMessages } from './projectConversation';
import { ProjectStageTracker } from './ProjectStageTracker';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import type { ClientProject } from './clientApi';

const raw = {
  stage: 'poc', stageLabel: 'Proof of concept', revisionLimit: 3, revisionsUsed: 0, version: 4, stageChangedAt: '2026-11-20T10:00:00Z',
  nextAction: { who: 'pm', kind: 'complete_poc', label: 'Move to the contract when the client is ready' },
  contract: null, rounds: [], requests: [], final: null,
};
const summary = (patch: Partial<StageSummary> = {}): StageSummary => ({ ...parseStageSummary(raw), ...patch });
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };

describe('project stage model', () => {
  it('reads a stage summary strictly', () => {
    const value = parseStageSummary(raw);
    expect(value).toMatchObject({ stage: 'poc', nextAction: { who: 'pm', kind: 'complete_poc' } });
    // The POC is a stage marker: nothing about a written POC is kept, even from an older server.
    expect(Object.keys(parseStageSummary({ ...raw, poc: null, pocDraft: null, pocHistory: [] })).filter(key => key.startsWith('poc'))).toEqual([]);
    expect('clientId' in value).toBe(false);
    expect(parseStageSummary({ ...raw, clientId: 'client-a' }).clientId).toBe('client-a');
    expect(() => parseStageSummary({ ...raw, stage: 'launch' })).toThrow();
    expect(() => parseStageSummary({ ...raw, nextAction: { who: 'someone', kind: 'complete_poc', label: '' } })).toThrow();
    // An older server's written-POC steps read as nothing to do, so the panel still loads while the backend catches up.
    expect(parseStageSummary({ ...raw, nextAction: { who: 'client', kind: 'review_poc', label: 'Review POC v2' } }).nextAction).toBeNull();
    expect(() => parseStageSummary({ ...raw, nextAction: { who: 'pm', kind: 'launch_rocket', label: 'x' } })).toThrow();
    expect(parseStageResult({ receipt: { operationId: 'op', action: 'poc_completed', refId: null, version: 5 }, stage: raw }).receipt.version).toBe(5);
    expect(parseStageBadge({ stage: 'poc', label: 'Proof of concept', waitingOn: 'pm', actionLabel: null })).toMatchObject({ stage: 'poc' });
    expect(parseStageBadge({ stage: 'nope' })).toBeNull();
  });

  it('names the steps, the allowance and whose turn it is', () => {
    expect(stageSteps('contract').map(step => step.state)).toEqual(['done', 'current', 'upcoming', 'upcoming']);
    expect(stageSteps('completed').map(step => step.state)).toEqual(['done', 'done', 'done', 'done']);
    expect(stageSteps('unset').every(step => step.state === 'upcoming')).toBe(true);
    expect(revisionAllowance({ stage: 'poc', revisionLimit: 3, revisionsUsed: 0 })).toBeNull();
    expect(revisionAllowance({ stage: 'development', revisionLimit: 3, revisionsUsed: 4 })).toBe('Revisions: 3 of 3 used · 1 extra');
    expect(revisionAllowance({ stage: 'contract', revisionLimit: 3, revisionsUsed: 0 })).toBeNull();
    expect(nextActionLine(summary(), 'pm')).toEqual({ mine: true, text: 'Move to the contract when the client is ready' });
    expect(nextActionLine(summary(), 'client')).toEqual({ mine: false, text: 'Waiting for the project manager' });
  });

  it('tells each side what happened, from their side', () => {
    const moved = { action: 'poc_completed', refId: null, number: null, name: null, stage: null };
    expect(stageEventLine(moved, 'pm', 'pm')).toBe('You moved the project to the contract stage');
    expect(stageEventLine(moved, 'pm', 'client')).toBe('The project manager moved the project to the contract stage');
    // Events from before the POC became a marker still read as they happened.
    const event = { action: 'poc_approved', refId: 'poc-1', number: 2, name: 'Juan Dela Cruz', stage: null };
    expect(stageEventLine(event, 'client', 'pm')).toBe('The client approved POC v2 (signed as Juan Dela Cruz) · Next: the contract');
    expect(stageEventLine({ ...event, action: 'poc_published', name: null }, 'pm', 'client')).toBe('The project manager shared POC v2 for review');
  });

  it('shows stage events in the conversation as a line', () => {
    const { items } = parseConversation({ items: [
      { id: 'se:1', kind: 'stage_event', author: 'pm', body: '', createdAt: '2026-11-20T10:00:00Z', request: null, task: null,
        stage: { action: 'poc_completed', refId: null, number: null, name: null, stage: null } },
    ] });
    expect(conversationChatMessages(items, 'client')[0]).toMatchObject({ kind: 'event', body: 'The project manager moved the project to the contract stage' });
    expect(() => parseConversation({ items: [{ ...items[0], stage: null }] })).toThrow();
  });
});

describe('stage UI', () => {
  it('shows the tracker with the current step and the reader’s turn', () => {
    const html = renderToStaticMarkup(<ProjectStageTracker summary={summary()} role="pm" />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Proof of concept');
    expect(html).not.toContain('Unlimited changes');
    expect(html).toContain('Your turn: Move to the contract when the client is ready');
    expect(renderToStaticMarkup(<ProjectStageTracker summary={summary({ stage: 'development', revisionsUsed: 1 })} role="pm" />))
      .toContain('Revisions: 1 of 3 used');
  });

  it('tells the client the project is in the POC stage, with nothing to review or approve', () => {
    const props = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
    const html = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary()} />);
    expect(html).toContain('Your project is in the proof-of-concept stage');
    for (const gone of ['Approve this POC', 'Request changes', 'Features', 'Screens and pages']) expect(html).not.toContain(gone);
    const contract = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ stage: 'contract', nextAction: null })} />);
    expect(contract).toContain('preparing the development contract');
    expect(contract).not.toContain('approved scope');
  });

  it('gives the PM the starting-stage choice, and in POC only a way to move to the contract', () => {
    const props = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ stage: 'unset' })} />)).toContain('Where is this project now?');
    const poc = renderToStaticMarkup(<PmStagePanel {...props} summary={summary()} />);
    expect(poc).toContain('This project is in the proof-of-concept stage');
    expect(poc).toContain('Move to contract');
    for (const gone of ['New POC version', 'Write the POC', 'Summary of the proposed system', 'Add feature', 'Screens and pages', 'Not included',
      'Note to the client', 'Share with the client', 'Save draft']) expect(poc).not.toContain(gone);
  });
});
