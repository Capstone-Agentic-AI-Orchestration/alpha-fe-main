import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStageSummary, type Quote, type StageSummary } from './projectStages';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import { quoteAmount } from './StageQuotes';
import type { ClientProject } from './clientApi';

const base = parseStageSummary({
  stage: 'completed', stageLabel: 'Completed', revisionLimit: 3, revisionsUsed: 3, version: 1, stageChangedAt: '2026-11-21T10:00:00Z',
  nextAction: null, poc: null, pocDraft: null, pocHistory: [], contract: null, rounds: [], quotes: [],
  final: { deliveredAt: '2026-11-20T10:00:00Z', note: '', acceptedAt: '2026-11-21T10:00:00Z', acceptedName: 'Juan' },
});
const summary = (patch: Partial<StageSummary>): StageSummary => ({ ...base, ...patch });
const quote = (patch: Partial<Quote>): Quote => ({
  id: 'quote-1', kind: 'change_request', roundId: null, title: 'Add a gift card page', description: 'One week.', amount: null, currency: 'PHP',
  status: 'requested', requestedBy: 'client', requestedAt: '2026-11-22T10:00:00Z', sentAt: null, decidedName: null, decidedAt: null, ...patch,
});
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };
const client = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
const pm = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };

describe('quotes UI', () => {
  it('formats amounts in the quote’s currency', () => {
    expect(quoteAmount({ amount: '12000.00', currency: 'PHP' })).toMatch(/12,000\.00/);
    expect(quoteAmount({ amount: null, currency: 'PHP' })).toBe('');
  });

  it('lets the client ask for quoted new work after closure, and accept or decline a sent quote', () => {
    expect(renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({})} />)).toContain('Request new work (quoted)');
    const waiting = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ quotes: [quote({})] })} />);
    expect(waiting).toContain('preparing a quote');
    expect(waiting).not.toContain('Accept quote');
    const sent = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ quotes: [quote({ status: 'sent', amount: '12000.00', sentAt: '2026-11-22T11:00:00Z' })] })} />);
    expect(sent).toContain('Accept quote');
    expect(sent).toContain('Decline');
    expect(sent).toMatch(/12,000\.00/);
  });

  it('gives the PM a price form for requested quotes and the client’s decision for the rest', () => {
    const asked = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({ quotes: [quote({})] })} />);
    expect(asked).toContain('Send quote');
    expect(asked).toContain('asked by the client');
    const accepted = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({ quotes: [quote({ status: 'accepted', amount: '900.00',
      sentAt: '2026-11-22T11:00:00Z', decidedName: 'Juan', decidedAt: '2026-11-23T10:00:00Z' })] })} />);
    expect(accepted).toContain('Accepted by Juan');
  });
});
