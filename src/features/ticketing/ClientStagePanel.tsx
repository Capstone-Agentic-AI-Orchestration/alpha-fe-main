import { useState } from 'react';
import type { clientTicketApi, ClientProject } from './clientApi';
import { PocScopeView, stageDay } from './PocScopeView';
import { SignOffDialog } from './SignOffDialog';
import { ContractView } from './ContractView';
import { ClientDevelopmentStage, RoundHistory } from './ClientDevelopmentStage';
import { ClientRequests } from './StageRequests';
import type { StageResult, StageSummary } from './projectStages';
import './projectStages.css';

const newOperationId = () => crypto.randomUUID();

export interface ClientStagePanelProps {
  api: typeof clientTicketApi;
  project: ClientProject;
  summary: StageSummary;
  busy: boolean;
  actionError: string;
  readOnly?: boolean;
  run: (work: () => Promise<StageResult | StageSummary>, fallback: string) => Promise<boolean>;
}

/** What the client does at the project's current stage. The tracker above says where the project is; this says what to do. */
export function ClientStagePanel(props: Readonly<ClientStagePanelProps>) {
  const { summary } = props;
  return <div className="ps-panel">
    {summary.stage === 'unset' && <p className="ps-note">Your project manager will set this project’s stage. Until then, keep using the conversation as usual.</p>}
    {summary.stage === 'poc' && <ClientPocStage {...props} />}
    {summary.stage === 'contract' && <ClientContractStage {...props} />}
    {summary.stage === 'development' && <ClientDevelopmentStage {...props} />}
    {summary.stage === 'completed' && <ClientCompletedStage summary={summary} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <ClientRequests {...props} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <SignedContract summary={summary} />}
    {summary.stage !== 'poc' && summary.stage !== 'unset' && <ApprovedPoc summary={summary} />}
    {props.actionError && <p role="alert" className="ps-error">{props.actionError}</p>}
  </div>;
}

function ClientPocStage({ api, project, summary, busy, readOnly = false, run }: Readonly<ClientStagePanelProps>) {
  const [mode, setMode] = useState<'idle' | 'changes' | 'approve'>('idle');
  const [changes, setChanges] = useState('');
  const poc = summary.poc;
  if (!poc) return <p className="ps-note">Your project manager is preparing the proof of concept: what will be built, the screens, and what isn’t included.
    You can ask for as many changes as you need before approving it.</p>;
  const waiting = poc.status === 'published';
  const sendChanges = async () => {
    const body = changes.trim();
    if (!body) return;
    const done = await run(() => api.requestPocChanges(project.workspaceId, project.projectId, poc.id, { operationId: newOperationId(), body }),
      'Your change request was not sent. Try again.');
    if (done) { setChanges(''); setMode('idle'); }
  };
  const approve = async (fullName: string) => {
    if (!poc.contentHash) return;
    const done = await run(() => api.approvePoc(project.workspaceId, project.projectId, poc.id,
      { operationId: newOperationId(), contentHash: poc.contentHash!, fullName }), 'The approval was not saved. Try again.');
    if (done) setMode('idle');
  };
  return <>
    <p className="ps-lead">{waiting
      ? <>Review <strong>POC v{poc.number}</strong>. Ask for changes as often as you need, then approve it to move on to the contract.</>
      : <>You asked for changes to POC v{poc.number} on {stageDay(poc.changeRequest?.createdAt ?? poc.updatedAt)}. Your project manager will share an updated version.</>}
    </p>
    <PocScopeView poc={poc} />
    {poc.changeRequest && !waiting && <blockquote className="ps-quote">{poc.changeRequest.body}</blockquote>}
    {waiting && !readOnly && mode === 'idle' && <div className="ps-actions">
      <button type="button" className="ps-button is-primary" onClick={() => setMode('approve')} disabled={busy}>Approve this POC</button>
      <button type="button" className="ps-button" onClick={() => setMode('changes')} disabled={busy}>Request changes</button>
    </div>}
    {waiting && mode === 'changes' && <form className="ps-form" onSubmit={event => { event.preventDefault(); void sendChanges(); }}>
      <label className="ps-field">
        <span>What should change in v{poc.number}?</span>
        <textarea value={changes} onChange={event => setChanges(event.target.value)} rows={4} maxLength={4000} disabled={busy} autoFocus />
      </label>
      <div className="ps-actions">
        <button type="submit" className="ps-button is-primary" disabled={busy || !changes.trim()}>Send change request</button>
        <button type="button" className="ps-button" onClick={() => setMode('idle')} disabled={busy}>Cancel</button>
      </div>
    </form>}
    {mode === 'approve' && <SignOffDialog title={`Approve POC v${poc.number}`} busy={busy} confirmLabel="Approve POC"
      consent="I approve this proof of concept as the basis for the development contract."
      onCancel={() => setMode('idle')} onConfirm={fullName => void approve(fullName)}>
      <p className="ps-copy"><strong>{poc.title}</strong> · {poc.features.length} feature{poc.features.length === 1 ? '' : 's'}
        {poc.screens.length > 0 && <> · {poc.screens.length} screen{poc.screens.length === 1 ? '' : 's'}</>}</p>
      <p className="ps-copy">After you approve, your project manager prepares the contract from this version. Changes after that are
        handled as revisions during development.</p>
    </SignOffDialog>}
  </>;
}

function ClientContractStage({ api, project, summary, busy, readOnly = false, run }: Readonly<ClientStagePanelProps>) {
  const [signing, setSigning] = useState(false);
  const contract = summary.contract;
  if (!contract) return <p className="ps-note">Your project manager is preparing the contract from the approved proof of concept.
    You’ll be asked to sign it here.</p>;
  const sign = async (fullName: string) => {
    if (!contract.contentHash) return;
    const done = await run(() => api.signContract(project.workspaceId, project.projectId, contract.id,
      { operationId: newOperationId(), contentHash: contract.contentHash!, fullName }), 'Your signature was not saved. Try again.');
    if (done) setSigning(false);
  };
  const waiting = contract.status === 'issued';
  return <>
    <p className="ps-lead">{waiting
      ? <>Read the development contract, then sign it. It includes <strong>{contract.terms.revisionLimit} revision round{contract.terms.revisionLimit === 1 ? '' : 's'}</strong> during development.</>
      : <>You signed the contract on {stageDay(contract.clientSignedAt)}. Development starts when your project manager countersigns.</>}</p>
    <ContractView contract={contract} />
    {waiting && !readOnly && <div className="ps-actions">
      <button type="button" className="ps-button is-primary" onClick={() => setSigning(true)} disabled={busy}>Sign the contract</button>
    </div>}
    {signing && <SignOffDialog title="Sign the development contract" busy={busy} confirmLabel="Sign contract"
      consent="I have read and agree to this development contract."
      onCancel={() => setSigning(false)} onConfirm={fullName => void sign(fullName)}>
      <p className="ps-copy"><strong>{contract.terms.projectName}</strong> · scope from POC v{contract.terms.scope.pocNumber} ·
        {' '}{contract.terms.revisionLimit} revision round{contract.terms.revisionLimit === 1 ? '' : 's'} included</p>
      <p className="ps-copy">Your project manager countersigns next, and development starts.</p>
    </SignOffDialog>}
  </>;
}

/** After closure: what was accepted, and how new work is handled. */
function ClientCompletedStage({ summary }: Readonly<{ summary: StageSummary }>) {
  const past = summary.rounds.filter(round => round.status === 'classified');
  return <>
    <p className="ps-lead">{summary.final?.acceptedAt
      ? <>You accepted the final delivery on {stageDay(summary.final.acceptedAt)}. The contract is closed.</>
      : <>This project is complete and its contract is closed.</>}</p>
    <p className="ps-note">New features or changes outside the agreed scope cost additional and are billed separately.</p>
    {past.length > 0 && <RoundHistory rounds={past} />}
  </>;
}

/** The signed contract, folded to one line during development and after. */
function SignedContract({ summary }: Readonly<{ summary: StageSummary }>) {
  const contract = summary.contract?.status === 'countersigned' ? summary.contract : null;
  const [open, setOpen] = useState(false);
  if (!contract) return null;
  return <div className="ps-approved">
    <p className="ps-lead">Contract signed by {contract.clientSignedName} and {contract.pmSignedName} on {stageDay(contract.pmSignedAt)}.</p>
    <button type="button" className="ps-link" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      {open ? 'Hide the contract' : 'Show the contract'}</button>
    {open && <ContractView contract={contract} />}
  </div>;
}

/** The approved POC, folded to one line once the project has moved on. */
function ApprovedPoc({ summary }: Readonly<{ summary: StageSummary }>) {
  const poc = summary.poc?.status === 'approved' ? summary.poc : null;
  const [open, setOpen] = useState(false);
  if (!poc) return null;
  return <div className="ps-approved">
    <p className="ps-lead">POC v{poc.number} approved{poc.approvedName ? ` by ${poc.approvedName}` : ''} on {stageDay(poc.approvedAt)}.</p>
    <button type="button" className="ps-link" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      {open ? 'Hide the approved scope' : 'Show the approved scope'}</button>
    {open && <PocScopeView poc={poc} compact />}
  </div>;
}
