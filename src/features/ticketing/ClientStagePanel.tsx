import { useState } from 'react';
import type { clientTicketApi, ClientProject } from './clientApi';
import { stageDay } from './stageDates';
import { ContractView } from './ContractView';
import { ClientDevelopmentStage, RoundHistory } from './ClientDevelopmentStage';
import { ClientRequests } from './StageRequests';
import type { StageResult, StageSummary } from './projectStages';
import './projectStages.css';

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
    {/* 'contract' is the old in-app contract stage; the contract is now signed in person, so it reads as the end of the POC. */}
    {(summary.stage === 'poc' || summary.stage === 'contract') && <p className="ps-lead">Your project is in the proof-of-concept stage.
      Talk the idea through with your project manager here. You sign the development contract with them in person, then development starts.</p>}
    {summary.stage === 'development' && <ClientDevelopmentStage {...props} />}
    {summary.stage === 'completed' && <ClientCompletedStage summary={summary} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <ClientRequests {...props} />}
    {(summary.stage === 'development' || summary.stage === 'completed') && <SignedContract summary={summary} />}
    {props.actionError && <p role="alert" className="ps-error">{props.actionError}</p>}
  </div>;
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

