import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStageSummary, type RevisionRound, type StageSummary } from './projectStages';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import type { ClientProject } from './clientApi';

const base = parseStageSummary({
  stage: 'development', stageLabel: 'Development', revisionLimit: 3, revisionsUsed: 0, version: 1, stageChangedAt: '2026-11-21T10:00:00Z',
  nextAction: null, poc: null, pocDraft: null, pocHistory: [], contract: null, rounds: [], quotes: [], final: null,
});
const summary = (patch: Partial<StageSummary>): StageSummary => ({ ...base, ...patch });
const round = (patch: Partial<RevisionRound>): RevisionRound => ({
  id: 'round-1', number: 1, status: 'open', buildNote: 'New charts', previewUrl: 'https://demo.vercel.app', counts: null, paid: false, quoteId: null,
  openedAt: '2026-11-22T10:00:00Z', submittedAt: null, classifiedAt: null,
  items: [{ id: 'item-1', position: 0, body: 'Make the header blue', classification: null, pmNote: '' }], ...patch,
});
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };
const client = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
const pm = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };

describe('development stage UI', () => {
  it('lets the client collect notes for the shared build and send them as one round', () => {
    const html = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ rounds: [round({})] })} />);
    expect(html).toContain('Build 1 is ready for your feedback');
    expect(html).toContain('Make the header blue');
    expect(html).toContain('Send round 1 of 3');
    expect(html).toContain('https://demo.vercel.app');
    expect(renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({})} />)).toContain('will share the next build');
  });

  it('tells the client when the included rounds are used, and asks before sending a paid round', () => {
    const html = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ revisionsUsed: 3, rounds: [round({ number: 4 })] })} />);
    expect(html).toContain('Your 3 included revision rounds are used.');
    expect(html).toContain('Send as a paid round');
    expect(html).not.toContain('Send round 4 of 3');
  });

  it('shows what each earlier note counted as', () => {
    const done = round({ status: 'classified', counts: true, submittedAt: '2026-11-22T11:00:00Z', classifiedAt: '2026-11-22T12:00:00Z',
      items: [{ id: 'item-1', position: 0, body: 'Make the header blue', classification: 'revision', pmNote: '' }] });
    expect(renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ revisionsUsed: 1, rounds: [done] })} />)).toContain('Earlier rounds (1)');
  });

  it('asks the client to accept the final delivery, and says when the contract is closed', () => {
    const waiting = renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ final: { deliveredAt: '2026-11-23T10:00:00Z',
      note: 'All live.', acceptedAt: null, acceptedName: null } })} />);
    expect(waiting).toContain('Accept final delivery');
    expect(waiting).toContain('All live.');
    expect(renderToStaticMarkup(<ClientStagePanel {...client} summary={summary({ stage: 'completed', final: { deliveredAt: '2026-11-23T10:00:00Z',
      note: '', acceptedAt: '2026-11-24T10:00:00Z', acceptedName: 'Juan' } })} />)).toContain('The contract is closed.');
  });

  it('gives the PM build sharing, the final delivery, and labels for a sent round', () => {
    const idle = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({})} />);
    expect(idle).toContain('Share a build for feedback');
    expect(idle).toContain('Mark final delivery');
    const sent = renderToStaticMarkup(<PmStagePanel {...pm} summary={summary({ rounds: [round({ status: 'submitted', submittedAt: '2026-11-22T11:00:00Z' })] })} />);
    expect(sent).toContain('Feedback round 1');
    expect(sent).toContain('Out of scope');
    expect(sent).not.toContain('Share a build for feedback');
  });
});
