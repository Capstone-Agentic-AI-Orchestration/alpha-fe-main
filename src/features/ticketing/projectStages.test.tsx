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
  nextAction: { who: 'pm', kind: 'start_development', label: 'Start development once the contract is signed' },
  contract: null, rounds: [], requests: [], final: null,
};
const summary = (patch: Partial<StageSummary> = {}): StageSummary => ({ ...parseStageSummary(raw), ...patch });
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };

describe('project stage model', () => {
  it('reads a stage summary strictly', () => {
    const value = parseStageSummary(raw);
    expect(value).toMatchObject({ stage: 'poc', nextAction: { who: 'pm', kind: 'start_development' } });
    // The POC is a stage marker: nothing about a written POC is kept, even from an older server.
    expect(Object.keys(parseStageSummary({ ...raw, poc: null, pocDraft: null, pocHistory: [] })).filter(key => key.startsWith('poc'))).toEqual([]);
    expect('clientId' in value).toBe(false);
    expect(parseStageSummary({ ...raw, clientId: 'client-a' }).clientId).toBe('client-a');
    expect(() => parseStageSummary({ ...raw, stage: 'launch' })).toThrow();
    expect(() => parseStageSummary({ ...raw, nextAction: { who: 'someone', kind: 'start_development', label: '' } })).toThrow();
    // An older server's written-POC steps read as nothing to do, so the panel still loads while the backend catches up.
    expect(parseStageSummary({ ...raw, nextAction: { who: 'client', kind: 'review_poc', label: 'Review POC v2' } }).nextAction).toBeNull();
    expect(() => parseStageSummary({ ...raw, nextAction: { who: 'pm', kind: 'launch_rocket', label: 'x' } })).toThrow();
    // An older server's contract steps read as nothing to do, too.
    for (const kind of ['complete_poc', 'issue_contract', 'sign_contract', 'countersign_contract']) {
      expect(parseStageSummary({ ...raw, nextAction: { who: 'client', kind, label: 'x' } }).nextAction).toBeNull();
    }
    expect(parseStageResult({ receipt: { operationId: 'op', action: 'development_started', refId: null, version: 5 }, stage: raw }).receipt.version).toBe(5);
    expect(parseStageBadge({ stage: 'poc', label: 'Proof of concept', waitingOn: 'pm', actionLabel: null })).toMatchObject({ stage: 'poc' });
    expect(parseStageBadge({ stage: 'nope' })).toBeNull();
  });

  it('names the steps, the allowance and whose turn it is', () => {
    // Three steps: the contract is signed in person. A project left in the old Contract stage reads as the end of the POC.
    expect(stageSteps('poc').map(step => [step.label, step.state])).toEqual([['Proof of concept', 'current'], ['Development', 'upcoming'], ['Completed', 'upcoming']]);
    expect(stageSteps('contract').map(step => step.state)).toEqual(['current', 'upcoming', 'upcoming']);
    expect(stageSteps('development').map(step => step.state)).toEqual(['done', 'current', 'upcoming']);
    expect(stageSteps('completed').map(step => step.state)).toEqual(['done', 'done', 'done']);
    expect(stageSteps('unset').every(step => step.state === 'upcoming')).toBe(true);
    expect(revisionAllowance({ stage: 'poc', revisionLimit: 3, revisionsUsed: 0 })).toBeNull();
    expect(revisionAllowance({ stage: 'development', revisionLimit: 3, revisionsUsed: 4 })).toBe('Revisions: 3 of 3 used · 1 extra');
    expect(revisionAllowance({ stage: 'contract', revisionLimit: 3, revisionsUsed: 0 })).toBeNull();
    expect(nextActionLine(summary(), 'pm')).toEqual({ mine: true, text: 'Start development once the contract is signed' });
    expect(nextActionLine(summary(), 'client')).toEqual({ mine: false, text: 'Waiting for the project manager' });
  });

  it('tells each side what happened, from their side', () => {
    const started = { action: 'development_started', refId: null, number: null, name: null, stage: null };
    expect(stageEventLine(started, 'pm', 'pm')).toBe('You started development · The contract was signed in person');
    expect(stageEventLine(started, 'pm', 'client')).toBe('The project manager started development · The contract was signed in person');
    expect(stageEventLine({ ...started, action: 'poc_completed' }, 'pm', 'client')).toBe('The project manager moved the project to the contract stage');
    // Events from before the POC became a marker still read as they happened.
    const event = { action: 'poc_approved', refId: 'poc-1', number: 2, name: 'Juan Dela Cruz', stage: null };
    expect(stageEventLine(event, 'client', 'pm')).toBe('The client approved POC v2 (signed as Juan Dela Cruz) · Next: the contract');
    expect(stageEventLine({ ...event, action: 'poc_published', name: null }, 'pm', 'client')).toBe('The project manager shared POC v2 for review');
  });

  it('shows stage events in the conversation as a line', () => {
    const { items } = parseConversation({ items: [
      { id: 'se:1', kind: 'stage_event', author: 'pm', body: '', createdAt: '2026-11-20T10:00:00Z', request: null, task: null,
        stage: { action: 'development_started', refId: null, number: null, name: null, stage: null } },
    ] });
    expect(conversationChatMessages(items, 'client')[0]).toMatchObject({ kind: 'event', body: 'The project manager started development · The contract was signed in person' });
    expect(() => parseConversation({ items: [{ ...items[0], stage: null }] })).toThrow();
  });
});

describe('stage UI', () => {
  it('shows the tracker with the current step and the reader’s turn', () => {
    const html = renderToStaticMarkup(<ProjectStageTracker summary={summary()} role="pm" />);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Proof of concept');
    expect(html).not.toContain('Unlimited changes');
    expect(html).toContain('Your turn: Start development once the contract is signed');
    expect(html).not.toContain('>Contract<');
    expect(renderToStaticMarkup(<ProjectStageTracker summary={summary({ stage: 'development', revisionsUsed: 1 })} role="pm" />))
      .toContain('Revisions: 1 of 3 used');
  });

  it('tells the client the project is in the POC stage, with nothing to review or approve', () => {
    const props = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
    const html = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary()} />);
    expect(html).toContain('Your project is in the proof-of-concept stage');
    for (const gone of ['Approve this POC', 'Request changes', 'Features', 'Screens and pages']) expect(html).not.toContain(gone);
    expect(html).toContain('You sign the development contract with them in person');
    // A project left in the old Contract stage shows the same line, with nothing to sign.
    const contract = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ stage: 'contract', nextAction: null })} />);
    expect(contract).toContain('Your project is in the proof-of-concept stage');
    expect(contract).not.toContain('Sign the contract');
  });

  it('gives the PM the starting-stage choice, and in POC only a way to start development', () => {
    const props = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ stage: 'unset' })} />)).toContain('Where is this project now?');
    const poc = renderToStaticMarkup(<PmStagePanel {...props} summary={summary()} />);
    expect(poc).toContain('This project is in the proof-of-concept stage');
    expect(poc).toContain('Start development');
    expect(poc).toContain('signed in person');
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ stage: 'contract' })} />)).toContain('Start development');
    for (const gone of ['New POC version', 'Write the POC', 'Summary of the proposed system', 'Add feature', 'Screens and pages', 'Not included',
      'Note to the client', 'Share with the client', 'Save draft']) expect(poc).not.toContain(gone);
  });
});
