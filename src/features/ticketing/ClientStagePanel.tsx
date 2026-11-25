import { useState } from 'react';
import type { clientTicketApi, ClientProject } from './clientApi';
import { stageDay } from './stageDates';
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
    {summary.stage === 'unset' && <p className="ps-note">The project manager will set this project’s stage. Until then, keep using the conversation as usual.</p>}
    {summary.stage === 'poc' && <p className="ps-lead">Your project is in the proof-of-concept stage. Talk the idea through with your project
      manager here; the contract comes next.</p>}
    {summary.stage === 'contract' && <ClientContractStage {...props} />}
    {summary.stage === 'development' && <ClientDevelopmentStage {...props} />}
    {summary.stage === 'completed' && <ClientCompletedStage summary={summary} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <ClientRequests {...props} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <SignedContract summary={summary} />}
    {props.actionError && <p role="alert" className="ps-error">{props.actionError}</p>}
  </div>;
}

function ClientContractStage({ api, project, summary, busy, readOnly = false, run }: Readonly<ClientStagePanelProps>) {
  const [signing, setSigning] = useState(false);
  const contract = summary.contract;
  if (!contract) return <p className="ps-note">The project manager is preparing the development contract.
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
      : <>You signed the contract on {stageDay(contract.clientSignedAt)}. Development starts when the project manager countersigns.</>}</p>
    <ContractView contract={contract} />
    {waiting && !readOnly && <div className="ps-actions">
      <button type="button" className="ps-button is-primary" onClick={() => setSigning(true)} disabled={busy}>Sign the contract</button>
    </div>}
    {signing && <SignOffDialog title="Sign the development contract" busy={busy} confirmLabel="Sign contract"
      consent="I have read and agree to this development contract."
      onCancel={() => setSigning(false)} onConfirm={fullName => void sign(fullName)}>
      <p className="ps-copy"><strong>{contract.terms.projectName}</strong> · {contract.terms.scope.title} ·
        {' '}{contract.terms.revisionLimit} revision round{contract.terms.revisionLimit === 1 ? '' : 's'} included</p>
      <p className="ps-copy">The project manager countersigns next, and development starts.</p>
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

