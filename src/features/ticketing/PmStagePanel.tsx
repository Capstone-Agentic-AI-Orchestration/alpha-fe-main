import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import type { pmTicketApi } from './pmApi';
import { stageDay } from './stageDates';
import type { Contract, ContractClause, StageResult, StageSummary } from './projectStages';
import { ContractView } from './ContractView';
import { SignOffDialog } from './SignOffDialog';
import { PmDevelopmentStage } from './PmDevelopmentStage';
import { PmRequests } from './StageRequests';

const newOperationId = () => crypto.randomUUID();
const link = 'h-auto justify-start px-0 py-0 text-[12px] font-semibold text-link hover:bg-transparent hover:text-link-hover';
const label = 'text-[11.5px] font-medium text-content-secondary';

export interface PmStagePanelProps {
  api: typeof pmTicketApi;
  projectId: string;
  clientId: string;
  summary: StageSummary;
  busy: boolean;
  actionError: string;
  run: (work: () => Promise<StageResult | StageSummary>, fallback: string) => Promise<boolean>;
}

/** The PM's side of the project's stage: what to prepare, publish or decide next. */
export function PmStagePanel(props: Readonly<PmStagePanelProps>) {
  const { summary } = props;
  return <div className="space-y-5 text-[13px]">
    {summary.stage === 'unset' && <StartingStagePicker {...props} />}
    {summary.stage === 'poc' && <PmPocStage {...props} />}
    {summary.stage === 'contract' && <PmContractStage {...props} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <PmRequests {...props} />}
    {summary.stage === 'development' && <PmDevelopmentStage {...props} />}
    {summary.stage === 'completed' && <p className="text-content-secondary">{summary.final?.acceptedName
      ? <>{summary.final.acceptedName} accepted the final delivery on {stageDay(summary.final.acceptedAt)}. The contract is closed.</>
      : 'This project is complete and its contract is closed.'} New work is a change request that costs the client additional.</p>}
    {(summary.stage === 'development' || summary.stage === 'completed') && summary.contract?.status === 'countersigned' && <SignedContractLine contract={summary.contract} />}
    {props.actionError && <p role="alert" className="text-[12.5px] text-status-danger">{props.actionError}</p>}
  </div>;
}

/** For projects that started before stages: where the project is now. Asked once. */
function StartingStagePicker({ api, projectId, clientId, busy, run }: Readonly<PmStagePanelProps>) {
  const [stage, setStage] = useState<'poc' | 'development' | 'completed'>('poc');
  const [used, setUsed] = useState(0);
  const [limit, setLimit] = useState(3);
  const save = () => void run(() => api.setStartingStage(projectId, clientId,
    { operationId: newOperationId(), stage, revisionsUsed: stage === 'development' ? used : 0, revisionLimit: limit }),
  'The stage was not saved. Try again.');
  return <section className="space-y-3">
    <div>
      <h3 className="text-[13px] font-semibold text-content">Where is this project now?</h3>
      <p className="mt-1 text-[12px] text-content-muted">It started before stages. Pick its current stage once; the client sees it in their conversation.</p>
    </div>
    <fieldset className="space-y-2">
      <legend className="sr-only">Current stage</legend>
      {([['poc', 'Proof of concept', 'Still agreeing on what to build'], ['development', 'Development', 'The contract is signed and work is under way'],
        ['completed', 'Completed', 'Delivered and accepted; new work costs additional']] as const).map(([value, title, hint]) =>
        <label key={value} className="flex cursor-pointer items-start gap-2.5">
          <input type="radio" name="starting-stage" value={value} checked={stage === value} onChange={() => setStage(value)} className="mt-1" />
          <span><span className="block font-medium text-content">{title}</span><span className="text-[12px] text-content-muted">{hint}</span></span>
        </label>)}
    </fieldset>
    {stage !== 'completed' && <div className="flex flex-wrap gap-4">
      <label className="space-y-1"><span className={label}>Included revision rounds</span>
        <Input type="number" min={0} max={20} value={limit} onChange={event => setLimit(Math.max(0, Math.min(20, Number(event.target.value) || 0)))} className="h-8 w-24" /></label>
      {stage === 'development' && <label className="space-y-1"><span className={label}>Rounds already used</span>
        <Input type="number" min={0} max={20} value={used} onChange={event => setUsed(Math.max(0, Math.min(20, Number(event.target.value) || 0)))} className="h-8 w-24" /></label>}
    </div>}
    <Button type="button" size="sm" onClick={save} disabled={busy}>Set stage</Button>
  </section>;
}

/**
 * The POC stage is a marker: nothing is written here. The features live as
 * tasks on the project's board; the PM moves the project to the contract once
 * the client is happy with the concept.
 */
function PmPocStage({ api, projectId, clientId, busy, run }: Readonly<PmStagePanelProps>) {
  const [confirming, setConfirming] = useState(false);
  const moveOn = async () => {
    const done = await run(() => api.completePoc(projectId, clientId, newOperationId()), 'The project was not moved to the contract. Try again.');
    if (done) setConfirming(false);
  };
  return <section className="space-y-3">
    <div>
      <h3 className="text-[13px] font-semibold text-content">Proof of concept</h3>
      <p className="mt-1 text-content-muted">This project is in the proof-of-concept stage. The client sees it in their conversation.
        Agree the concept with them here; the features are tracked as tasks on the board.</p>
    </div>
    {confirming
      ? <div className="space-y-2">
        <p className="text-content-secondary">Move this project to the contract stage? The client sees the change, and you prepare the contract next.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void moveOn()}>Move to contract</Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </div>
      : <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming(true)}>Move to contract</Button>}
  </section>;
}

function SignedContractLine({ contract }: Readonly<{ contract: Contract }>) {
  const [open, setOpen] = useState(false);
  return <section className="space-y-2">
    <p className="text-content-secondary">Contract signed by <strong className="text-content">{contract.clientSignedName}</strong> and
      {' '}<strong className="text-content">{contract.pmSignedName}</strong> on {stageDay(contract.pmSignedAt)}.</p>
    <Button type="button" variant="ghost" size="sm" className={link} onClick={() => setOpen(value => !value)} aria-expanded={open}>
      {open ? 'Hide the contract' : 'Show the contract'}</Button>
    {open && <ContractView contract={contract} />}
  </section>;
}

function PmContractStage({ api, projectId, clientId, summary, busy, run }: Readonly<PmStagePanelProps>) {
  const [countersigning, setCountersigning] = useState(false);
  const contract = summary.contract;
  if (!contract) return <section className="space-y-2">
    <h3 className="text-[13px] font-semibold text-content">Contract</h3>
    <p className="text-content-muted">Prepare the development contract: the agreed scope, the deliverables, {summary.revisionLimit} included revision
      rounds, and the standard terms. You can edit it before issuing.</p>
    <Button type="button" size="sm" disabled={busy}
      onClick={() => void run(() => api.saveContractDraft(projectId, clientId, {}), 'The contract was not prepared. Try again.')}>
      Prepare the contract</Button>
  </section>;
  if (contract.status === 'draft') return <ContractEditor key={contract.id} api={api} projectId={projectId} clientId={clientId}
    contract={contract} busy={busy} run={run} />;
  const countersign = async (fullName: string) => {
    const done = await run(() => api.countersignContract(projectId, clientId, contract.id, { operationId: newOperationId(), fullName }),
      'The countersignature was not saved. Try again.');
    if (done) setCountersigning(false);
  };
  return <section className="space-y-3">
    {contract.status === 'issued' && <>
      <p className="text-content-secondary">Issued {stageDay(contract.issuedAt)}. Waiting for the client to sign.</p>
      <Button type="button" size="sm" variant="outline" disabled={busy}
        onClick={() => void run(() => api.voidContract(projectId, clientId, contract.id, newOperationId()), 'The contract was not withdrawn. Try again.')}>
        Withdraw to edit</Button>
    </>}
    {contract.status === 'client_signed' && <>
      <p className="font-medium text-content">{contract.clientSignedName} signed on {stageDay(contract.clientSignedAt)}. Countersign to start development.</p>
      <Button type="button" size="sm" disabled={busy} onClick={() => setCountersigning(true)}>Countersign</Button>
    </>}
    <ContractView contract={contract} />
    {countersigning && <SignOffDialog title="Countersign the contract" busy={busy} confirmLabel="Countersign"
      consent="I countersign this development contract on behalf of Alphaexplora."
      onCancel={() => setCountersigning(false)} onConfirm={fullName => void countersign(fullName)}>
      <p className="ps-copy">Signed by {contract.clientSignedName}. Countersigning moves the project to Development.</p>
    </SignOffDialog>}
  </section>;
}

function ContractEditor({ api, projectId, clientId, contract, busy, run }: Readonly<Pick<PmStagePanelProps, 'api' | 'projectId' | 'clientId' | 'busy' | 'run'> & {
  contract: Contract;
}>) {
  const [scopeTitle, setScopeTitle] = useState(contract.terms.scope.title);
  const [scopeSummary, setScopeSummary] = useState(contract.terms.scope.summary);
  const [deliverables, setDeliverables] = useState(contract.terms.deliverables.join('\n'));
  const [clauses, setClauses] = useState<ContractClause[]>(contract.terms.clauses);
  const [notes, setNotes] = useState(contract.terms.notes);
  const input = () => ({ scope: { title: scopeTitle.trim(), summary: scopeSummary.trim() }, deliverables: deliverables.split('\n').map(line => line.trim()).filter(Boolean),
    clauses: clauses.map(clause => ({ title: clause.title.trim(), body: clause.body.trim() })).filter(clause => clause.title && clause.body),
    notes: notes.trim() });
  const ready = input().clauses.length > 0 && input().scope.title.length > 0;
  const save = () => run(() => api.saveContractDraft(projectId, clientId, input()), 'The draft was not saved. Try again.');
  const issue = () => void run(async () => {
    const saved = await api.saveContractDraft(projectId, clientId, input());
    if (!saved.contract) throw new Error('The draft was not saved. Try again.');
    return api.issueContract(projectId, clientId, saved.contract.id, newOperationId());
  }, 'The contract was not issued. Try again.');
  const setClause = (index: number, patch: Partial<ContractClause>) =>
    setClauses(current => current.map((clause, position) => position === index ? { ...clause, ...patch } : clause));
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); issue(); }}>
    <div>
      <h3 className="text-[13px] font-semibold text-content">Contract draft</h3>
      <p className="mt-1 text-[12px] text-content-muted">{contract.terms.revisionLimit} revision rounds. Only you see the draft. Issuing sends it to
        the client to sign, and fixes its text.</p>
    </div>
    <label className="block space-y-1"><span className={label}>Scope title</span>
      <Input value={scopeTitle} onChange={event => setScopeTitle(event.target.value)} maxLength={300} /></label>
    <label className="block space-y-1"><span className={label}>Agreed scope</span>
      <Textarea value={scopeSummary} onChange={event => setScopeSummary(event.target.value)} rows={3} maxLength={8000}
        placeholder="What the project covers, in a few sentences" /></label>
    <label className="block space-y-1"><span className={label}>Deliverables (one per line)</span>
      <Textarea value={deliverables} onChange={event => setDeliverables(event.target.value)} rows={4} /></label>
    <fieldset className="space-y-3">
      <legend className={label}>Terms</legend>
      {clauses.map((clause, index) => <div key={index} className="space-y-1.5 border-l-2 border-divider pl-3">
        <div className="flex items-center gap-1">
          <Input aria-label={`Clause ${index + 1} title`} value={clause.title} onChange={event => setClause(index, { title: event.target.value })} maxLength={300} className="h-8" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={clauses.length === 1}
            onClick={() => setClauses(current => current.filter((_, position) => position !== index))} aria-label={`Remove clause ${index + 1}`}>
            <Trash2 size={14} aria-hidden="true" /></Button>
        </div>
        <Textarea aria-label={`Clause ${index + 1} text`} value={clause.body} onChange={event => setClause(index, { body: event.target.value })} rows={3} maxLength={8000}
          className="text-[12.5px]" />
      </div>)}
      <Button type="button" variant="ghost" size="sm" className={link} disabled={clauses.length >= 30}
        onClick={() => setClauses(current => [...current, { title: '', body: '' }])}><Plus size={13} aria-hidden="true" />Add clause</Button>
    </fieldset>
    <label className="block space-y-1"><span className={label}>Notes (optional)</span>
      <Textarea value={notes} onChange={event => setNotes(event.target.value)} rows={2} maxLength={8000} /></label>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy || !ready}>Issue for signing</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy || !ready} onClick={() => void save()}>Save draft</Button>
    </div>
  </form>;
}
