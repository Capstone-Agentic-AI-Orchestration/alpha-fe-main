import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import type { pmTicketApi, PmPocDraft } from './pmApi';
import { PocScopeView, stageDay } from './PocScopeView';
import type { Contract, ContractClause, PocVersion, StageResult, StageSummary } from './projectStages';
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
    {summary.stage !== 'poc' && summary.stage !== 'unset' && summary.poc?.status === 'approved' && <section className="space-y-2">
      <p className="text-content-secondary">POC v{summary.poc.number} approved by <strong className="text-content">{summary.poc.approvedName}</strong> on {stageDay(summary.poc.approvedAt)}.</p>
      <PocScopeView poc={summary.poc} compact />
    </section>}
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

const emptyDraft: PmPocDraft = { title: '', summary: '', features: [{ title: '', detail: '' }], screens: [], outOfScope: '', note: '' };
const draftFrom = (poc: PocVersion | null): PmPocDraft => poc
  ? { title: poc.title, summary: poc.summary, features: poc.features.length ? poc.features : [{ title: '', detail: '' }],
    screens: poc.screens, outOfScope: poc.outOfScope, note: poc.note }
  : emptyDraft;

function PmPocStage(props: Readonly<PmStagePanelProps>) {
  const { summary } = props;
  const [editing, setEditing] = useState(false);
  const poc = summary.poc;
  const draft = summary.pocDraft;
  if (editing || draft) {
    return <PocEditor key={draft?.id ?? 'new'} {...props} draft={draft} start={draft ?? poc} onDone={() => setEditing(false)} />;
  }
  if (!poc) return <section className="space-y-2">
    <h3 className="text-[13px] font-semibold text-content">Proof of concept</h3>
    <p className="text-content-muted">Write what will be built: a summary, the features, the screens, and what isn’t included. The client can ask for
      changes any number of times, then approves one version to move on to the contract.</p>
    <Button type="button" size="sm" onClick={() => setEditing(true)}><Plus size={14} aria-hidden="true" />Write the POC</Button>
  </section>;
  const asked = poc.status === 'changes_requested';
  return <section className="space-y-3">
    <p className={asked ? 'font-medium text-status-warning' : 'text-content-secondary'}>
      {asked ? `The client asked for changes to v${poc.number}.` : `v${poc.number} is with the client for review.`}</p>
    {asked && poc.changeRequest && <blockquote className="border-l-2 border-status-warning-border pl-3 text-content whitespace-pre-wrap">{poc.changeRequest.body}</blockquote>}
    <Button type="button" size="sm" variant={asked ? 'default' : 'outline'} onClick={() => setEditing(true)}>
      {asked ? `Write v${poc.number + 1}` : 'Write a new version'}</Button>
    <PocScopeView poc={poc} compact />
    {summary.pocHistory.length > 1 && <p className="text-[12px] text-content-muted">Earlier versions: {summary.pocHistory.slice(1)
      .map(item => `v${item.number}`).join(', ')}</p>}
  </section>;
}

function PocEditor({ api, projectId, clientId, busy, run, draft, start, onDone }: Readonly<PmStagePanelProps & {
  draft: PocVersion | null; start: PocVersion | null; onDone: () => void;
}>) {
  const [value, setValue] = useState<PmPocDraft>(() => draftFrom(start));
  const [screens, setScreens] = useState(() => draftFrom(start).screens.join('\n'));
  const set = <K extends keyof PmPocDraft>(key: K, next: PmPocDraft[K]) => setValue(current => ({ ...current, [key]: next }));
  const setFeature = (index: number, patch: Partial<PmPocDraft['features'][number]>) =>
    set('features', value.features.map((feature, position) => position === index ? { ...feature, ...patch } : feature));
  const move = (index: number, by: number) => {
    const next = [...value.features];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    set('features', next);
  };
  const clean = (): PmPocDraft => ({ ...value, title: value.title.trim(), summary: value.summary.trim(),
    features: value.features.map(feature => ({ title: feature.title.trim(), detail: feature.detail.trim() })).filter(feature => feature.title),
    screens: screens.split('\n').map(line => line.trim()).filter(Boolean), outOfScope: value.outOfScope.trim(), note: value.note.trim() });
  const complete = (input: PmPocDraft) => Boolean(input.title && input.summary && input.features.length);
  const save = () => run(() => api.savePocDraft(projectId, clientId, clean()), 'The draft was not saved. Try again.');
  // Save first, then publish exactly the draft that was saved.
  const publish = async () => {
    const done = await run(async () => {
      const saved = await api.savePocDraft(projectId, clientId, clean());
      if (!saved.pocDraft) throw new Error('The draft was not saved. Try again.');
      return api.publishPoc(projectId, clientId, saved.pocDraft.id, newOperationId());
    }, 'The POC was not shared. Try again.');
    if (done) onDone();
  };
  const ready = complete(clean());
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void publish(); }}>
    <div>
      <h3 className="text-[13px] font-semibold text-content">{draft ? `Draft v${draft.number}` : 'New POC version'}</h3>
      <p className="mt-1 text-[12px] text-content-muted">Only you see a draft. Sharing it sends it to the client for review.</p>
    </div>
    <label className="block space-y-1"><span className={label}>Title</span>
      <Input value={value.title} onChange={event => set('title', event.target.value)} maxLength={300} placeholder="e.g. Restaurant booking website" /></label>
    <label className="block space-y-1"><span className={label}>Summary of the proposed system</span>
      <Textarea value={value.summary} onChange={event => set('summary', event.target.value)} rows={4} maxLength={8000} /></label>
    <fieldset className="space-y-2">
      <legend className={label}>Features</legend>
      {value.features.map((feature, index) => <div key={index} className="space-y-1.5 border-l-2 border-divider pl-3">
        <div className="flex items-center gap-1">
          <Input aria-label={`Feature ${index + 1}`} value={feature.title} onChange={event => setFeature(index, { title: event.target.value })}
            maxLength={300} placeholder="Feature" className="h-8" />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, -1)} disabled={index === 0}
            aria-label={`Move feature ${index + 1} up`}><ArrowUp size={14} aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, 1)}
            disabled={index === value.features.length - 1} aria-label={`Move feature ${index + 1} down`}><ArrowDown size={14} aria-hidden="true" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={value.features.length === 1}
            onClick={() => set('features', value.features.filter((_, position) => position !== index))} aria-label={`Remove feature ${index + 1}`}>
            <Trash2 size={14} aria-hidden="true" /></Button>
        </div>
        <Input aria-label={`Feature ${index + 1} details`} value={feature.detail} onChange={event => setFeature(index, { detail: event.target.value })}
          maxLength={2000} placeholder="Details (optional)" className="h-8 text-[12.5px]" />
      </div>)}
      <Button type="button" variant="ghost" size="sm" className={link} onClick={() => set('features', [...value.features, { title: '', detail: '' }])}
        disabled={value.features.length >= 100}><Plus size={13} aria-hidden="true" />Add feature</Button>
    </fieldset>
    <label className="block space-y-1"><span className={label}>Screens and pages (one per line)</span>
      <Textarea value={screens} onChange={event => setScreens(event.target.value)} rows={3} /></label>
    <label className="block space-y-1"><span className={label}>Not included</span>
      <Textarea value={value.outOfScope} onChange={event => set('outOfScope', event.target.value)} rows={2} maxLength={4000} /></label>
    <label className="block space-y-1"><span className={label}>Note to the client (optional)</span>
      <Textarea value={value.note} onChange={event => set('note', event.target.value)} rows={2} maxLength={4000} /></label>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" size="sm" disabled={busy || !ready}>Share with the client</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy || !ready} onClick={() => void save()}>Save draft</Button>
      {!draft && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onDone}>Cancel</Button>}
    </div>
    {!ready && <p className="text-[12px] text-content-muted">A title, a summary and at least one feature are needed.</p>}
  </form>;
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
    <p className="text-content-muted">The client approved POC v{summary.poc?.number}. Prepare the contract from it: the approved scope, its features as
      deliverables, {summary.revisionLimit} included revision rounds, and the standard terms. You can edit it before issuing.</p>
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
  const [deliverables, setDeliverables] = useState(contract.terms.deliverables.join('\n'));
  const [clauses, setClauses] = useState<ContractClause[]>(contract.terms.clauses);
  const [notes, setNotes] = useState(contract.terms.notes);
  const input = () => ({ deliverables: deliverables.split('\n').map(line => line.trim()).filter(Boolean),
    clauses: clauses.map(clause => ({ title: clause.title.trim(), body: clause.body.trim() })).filter(clause => clause.title && clause.body),
    notes: notes.trim() });
  const ready = input().clauses.length > 0;
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
      <p className="mt-1 text-[12px] text-content-muted">Scope from POC v{contract.terms.scope.pocNumber} · {contract.terms.revisionLimit} revision rounds.
        Only you see the draft. Issuing sends it to the client to sign, and fixes its text.</p>
    </div>
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
