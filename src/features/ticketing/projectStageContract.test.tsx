import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseStageSummary, type Contract, type StageSummary } from './projectStages';
import { ClientStagePanel } from './ClientStagePanel';
import { PmStagePanel } from './PmStagePanel';
import { ContractView } from './ContractView';
import type { ClientProject } from './clientApi';

const poc = {
  id: 'poc-1', number: 1, status: 'approved', title: 'Booking site', summary: 'Customers book a table.',
  features: [{ title: 'Online booking', detail: '' }], screens: [], outOfScope: '', note: '', contentHash: 'a'.repeat(64),
  createdAt: '2026-11-20T10:00:00Z', updatedAt: '2026-11-20T10:00:00Z', publishedAt: '2026-11-20T10:00:00Z',
  approvedAt: '2026-11-21T10:00:00Z', approvedName: 'Juan Dela Cruz', changeRequest: null,
};
const contract: Contract = {
  id: 'contract-1', pocVersionId: 'poc-1', status: 'issued', contentHash: 'b'.repeat(64),
  createdAt: '2026-11-21T10:00:00Z', updatedAt: '2026-11-21T10:00:00Z', issuedAt: '2026-11-21T10:00:00Z',
  clientSignedName: null, clientSignedAt: null, pmSignedName: null, pmSignedAt: null,
  terms: { projectName: 'Project A', clientName: 'Client A', revisionLimit: 3, notes: 'Launch before March.',
    scope: { pocNumber: 1, title: 'Booking site', summary: 'Customers book a table.', features: poc.features, screens: [], outOfScope: '' },
    deliverables: ['Online booking'], clauses: [{ title: 'Product Development Stage', body: 'Three (3) rounds of revisions.' }] },
};
const base = parseStageSummary({
  stage: 'contract', stageLabel: 'Contract', revisionLimit: 3, revisionsUsed: 0, version: 1, stageChangedAt: '2026-11-21T10:00:00Z',
  nextAction: null, poc, pocDraft: null, pocHistory: [], contract: null, rounds: [], requests: [], final: null,
});
const summary = (patch: Partial<StageSummary>): StageSummary => ({ ...base, ...patch });
const project: ClientProject = { workspaceId: 'w', projectId: 'p', name: 'Project', updatedAt: '2026-11-20T10:00:00Z', intakeOptionId: 'o', preview: null };

describe('contract stage UI', () => {
  it('shows the contract text, the scope and both signature lines', () => {
    const html = renderToStaticMarkup(<ContractView contract={contract} />);
    expect(html).toContain('Development contract');
    expect(html).toContain('approved POC v1');
    expect(html).toContain('Three (3) rounds of revisions.');
    expect(html).toContain('Launch before March.');
    expect(html.match(/Not signed yet/g)).toHaveLength(2);
    expect(renderToStaticMarkup(<ContractView contract={{ ...contract, status: 'countersigned', clientSignedName: 'Juan',
      clientSignedAt: '2026-11-22T10:00:00Z', pmSignedName: 'Pat', pmSignedAt: '2026-11-22T11:00:00Z' }} />)).not.toContain('Not signed yet');
  });

  it('asks the client to sign an issued contract, then waits for the countersignature', () => {
    const props = { api: {} as never, project, busy: false, actionError: '', run: vi.fn() };
    expect(renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({})} />)).toContain('preparing the contract');
    const issued = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ contract })} />);
    expect(issued).toContain('Sign the contract');
    expect(issued).toContain('3 revision rounds');
    const signed = renderToStaticMarkup(<ClientStagePanel {...props} summary={summary({ contract: { ...contract, status: 'client_signed',
      clientSignedName: 'Juan', clientSignedAt: '2026-11-22T10:00:00Z' } })} />);
    expect(signed).not.toContain('>Sign the contract<');
    expect(signed).toContain('countersigns');
  });

  it('walks the PM from preparing the contract to countersigning it', () => {
    const props = { api: {} as never, projectId: 'p', clientId: 'c', busy: false, actionError: '', run: vi.fn() };
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({})} />)).toContain('Prepare the contract');
    const draft = renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ contract: { ...contract, status: 'draft', contentHash: null, issuedAt: null } })} />);
    expect(draft).toContain('Issue for signing');
    expect(draft).toContain('Product Development Stage');
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ contract })} />)).toContain('Withdraw to edit');
    expect(renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ contract: { ...contract, status: 'client_signed',
      clientSignedName: 'Juan', clientSignedAt: '2026-11-22T10:00:00Z' } })} />)).toContain('Countersign');
    const developing = renderToStaticMarkup(<PmStagePanel {...props} summary={summary({ stage: 'development', contract: { ...contract, status: 'countersigned',
      clientSignedName: 'Juan', clientSignedAt: '2026-11-22T10:00:00Z', pmSignedName: 'Pat', pmSignedAt: '2026-11-22T11:00:00Z' } })} />);
    expect(developing).toContain('Contract signed by');
  });
});
