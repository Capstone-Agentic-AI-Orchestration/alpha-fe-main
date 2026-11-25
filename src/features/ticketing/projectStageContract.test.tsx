import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStageSummary, type Contract, type StageSummary } from './projectStages';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import { ContractView } from './ContractView';
import type { ClientProject } from './clientApi';

/** A contract countersigned in Alpha before contracts moved to signing in person. */
const signed: Contract = {
  id: 'contract-1', pocVersionId: null, status: 'countersigned', contentHash: 'b'.repeat(64),
  createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-22T11:00:00Z', issuedAt: '2026-11-21T10:00:00Z',
  clientSignedName: 'Juan', clientSignedAt: '2026-11-22T10:00:00Z', pmSignedName: 'Pat', pmSignedAt: '2026-11-22T11:00:00Z',
  terms: { projectName: 'Project A', clientName: 'Client A', revisionLimit: 3, notes: 'Launch before March.',
    scope: { title: 'Booking site', summary: 'Customers book a table.' },
    deliverables: ['Online booking'], clauses: [{ title: 'Product Development Stage', body: 'Three (3) rounds of revisions.' }] },
};
const raw = {
  stage: 'development', stageLabel: 'Development', revisionLimit: 3, revisionsUsed: 0, version: 1, stageChangedAt: '2026-11-21T10:00:00Z',
  nextAction: null, contract: null, rounds: [], requests: [], final: null,
};
const base = parseStageSummary(raw);
const summary = (patch: Partial<StageSummary>): StageSummary => ({ ...base, ...patch });
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };
const clientProps = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
const pmProps = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };

describe('contracts signed in Alpha before signing moved offline', () => {
  it('shows the signed contract text, read-only, with both signatures', () => {
    const html = renderToStaticMarkup(<ContractView contract={signed} />);
    expect(html).toContain('Development contract');
    expect(html).toContain('Customers book a table.');
    expect(html).toContain('Three (3) rounds of revisions.');
    expect(html).not.toContain('Not signed yet');
  });

  it('folds the signed contract to one line in development, for both sides', () => {
    for (const html of [renderToStaticMarkup(<ClientStagePanel {...clientProps} summary={summary({ contract: signed })} />),
      renderToStaticMarkup(<PmStagePanel {...pmProps} summary={summary({ contract: signed })} />)]) {
      expect(html).toContain('Contract signed by');
      expect(html).toContain('Show the contract');
    }
    // A project whose contract was signed in person has nothing to show.
    expect(renderToStaticMarkup(<PmStagePanel {...pmProps} summary={summary({})} />)).not.toContain('Contract signed by');
    expect(parseStageSummary({ ...raw, contract: signed }).contract).toMatchObject({ status: 'countersigned', pmSignedName: 'Pat' });
  });

  it('offers no way to draft, issue, sign or countersign a contract', () => {
    for (const stage of ['poc', 'contract', 'development'] as const) {
      const pm = renderToStaticMarkup(<PmStagePanel {...pmProps} summary={summary({ stage })} />);
      const client = renderToStaticMarkup(<ClientStagePanel {...clientProps} summary={summary({ stage })} />);
      for (const gone of ['Prepare the contract', 'Issue for signing', 'Withdraw to edit', 'Countersign', 'Scope title', 'Agreed scope']) {
        expect(pm).not.toContain(gone);
      }
      expect(client).not.toContain('Sign the contract');
    }
  });
});
