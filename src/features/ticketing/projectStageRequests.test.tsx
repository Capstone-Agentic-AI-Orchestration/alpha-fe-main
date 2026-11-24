import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStageSummary, stageEventLine, type ChangeRequest, type StageSummary } from './projectStages';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import type { ClientProject } from './clientApi';

const base = parseStageSummary({
  stage: 'completed', stageLabel: 'Completed', revisionLimit: 3, revisionsUsed: 3, version: 1, stageChangedAt: '2026-11-21T10:00:00Z',
  nextAction: null, poc: null, pocDraft: null, pocHistory: [], contract: null, rounds: [], requests: [],
  final: { deliveredAt: '2026-11-20T10:00:00Z', note: '', acceptedAt: '2026-11-21T10:00:00Z', acceptedName: 'Juan' },
});
const summary = (patch: Partial<StageSummary>): StageSummary => ({ ...base, ...patch });
const request = (patch: Partial<ChangeRequest>): ChangeRequest => ({
  id: 'request-1', roundId: null, title: 'Add a gift card page', description: 'For the holidays.', status: 'open',
  requestedBy: 'client', requestedAt: '2026-11-22T10:00:00Z', reply: '', answeredAt: null, ...patch,
});
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };
const client = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
const pm = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };

describe('change requests', () => {
  it('reads requests strictly', () => {
    expect(parseStageSummary({ ...base, requests: [request({})] }).requests[0]).toMatchObject({ status: 'open', reply: '' });
    expect(() => parseStageSummary({ ...base, requests: [request({ status: 'sent' as never })] })).toThrow();
    expect(() => parseStageSummary({ ...base, requests: undefined })).toThrow();
  });

  it('lets the client ask for new work after closure, with no price and no accept step', () => {
    expect(renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({})} />)).toContain('Request new work');
    const waiting = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ requests: [request({})] })} />);
    expect(waiting).toContain('Add a gift card page');
    expect(waiting).toContain('Waiting for an answer');
    expect(waiting).not.toMatch(/quote|Accept quote|Decline/i);
    const answered = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ requests: [request({ status: 'will_do',
      reply: 'We can start next week.', answeredAt: '2026-11-23T10:00:00Z' })] })} />);
    expect(answered).toContain('Will do');
    expect(answered).toContain('This costs additional, billed separately from your contract.');
    expect(answered).toContain('We can start next week.');
  });

  it('gives the PM "will do" and "won’t do" for open requests, and the answer for the rest', () => {
    const asked = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({ requests: [request({})] })} />);
    expect(asked).toContain('Will do');
    expect(asked).toContain('Won’t do');
    expect(asked).toContain('Asked by the client');
    expect(asked).not.toMatch(/amount|currency|quote/i);
    const fromRound = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({ stage: 'development', final: null,
      rounds: [{ id: 'round-2', number: 2, status: 'classified', buildNote: '', previewUrl: null, counts: true, extra: false,
        openedAt: '2026-11-22T10:00:00Z', submittedAt: '2026-11-22T11:00:00Z', classifiedAt: '2026-11-22T12:00:00Z', items: [] }],
      requests: [request({ requestedBy: 'pm', roundId: 'round-2', status: 'wont_do', answeredAt: '2026-11-23T10:00:00Z' })] })} />);
    expect(fromRound).toContain('From feedback round 2');
    expect(fromRound).toContain('Won’t do');
  });

  it('tells each side in the conversation what was asked and answered', () => {
    const event = { action: 'request_answered', refId: 'request-1', number: null, name: null, stage: null, decision: 'will_do', title: 'Gift cards' };
    expect(stageEventLine(event, 'pm', 'client')).toBe('The project manager will do “Gift cards” · This costs additional, billed separately from your contract.');
    expect(stageEventLine({ ...event, decision: 'wont_do' }, 'pm', 'client')).toBe('The project manager won’t do “Gift cards”');
    expect(stageEventLine({ ...event, action: 'request_made' }, 'client', 'pm')).toContain('The client asked for new work');
    expect(stageEventLine({ ...event, action: 'round_submitted', number: 4, extra: true }, 'client', 'client'))
      .toBe('You sent feedback round 4 · An extra round, billed separately');
  });
});
