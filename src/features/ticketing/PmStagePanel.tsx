import { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import type { pmTicketApi } from './pmApi';
import { stageDay } from './stageDates';
import type { Contract, StageResult, StageSummary } from './projectStages';
import { ContractView } from './ContractView';
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
export function PmStagePanel(props: Readonly<PmStagePanelProps & { startInHeader?: boolean }>) {
  const { summary } = props;
  return <div className="space-y-5 text-[13px]">
    {summary.stage === 'unset' && <StartingStagePicker {...props} />}
    {(summary.stage === 'poc' || summary.stage === 'contract') && <section className="space-y-3">
      <h3 className="text-[13px] font-semibold text-content">Proof of concept</h3>
      <p className="text-content-muted">Share the concept or test results in the conversation. Start development after signing the contract in person.</p>
      {!props.startInHeader && <PmStartDevelopment {...props} />}
    </section>}
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
      {([['poc', 'Proof of concept', 'Confirming the approach or arranging signing'], ['development', 'Development', 'The contract is signed and work is under way'],
        ['completed', 'Completed', 'Delivered and accepted; new work costs additional']] as const).map(([value, title, hint]) =>
        <label key={value} className="flex cursor-pointer items-start gap-2.5">
          <input type="radio" name="starting-stage" value={value} checked={stage === value} onChange={() => setStage(value)} className="mt-1" />
          <span><span className="block font-medium text-content">{title}</span><span className="text-[12px] text-content-muted">{hint}</span></span>
        </label>)}
    </fieldset>
    {stage !== 'completed' && <div className="flex flex-wrap gap-4">
      <label className="space-y-1"><span className={label}>Included revision rounds</span>
        <Input type="number" min={0} max={20} value={limit} onChange={event => setLimit(rounds(event.target.value))} className="h-8 w-24" /></label>
      {stage === 'development' && <label className="space-y-1"><span className={label}>Rounds already used</span>
        <Input type="number" min={0} max={20} value={used} onChange={event => setUsed(rounds(event.target.value))} className="h-8 w-24" /></label>}
    </div>}
    <Button type="button" size="sm" onClick={save} disabled={busy}>Set stage</Button>
  </section>;
}

const rounds = (value: string) => Math.max(0, Math.min(20, Math.trunc(Number(value)) || 0));

/** Confirm the offline signing and record the revision allowance together. */
export function PmStartDevelopment({ api, projectId, clientId, summary, busy, actionError, run }: Readonly<PmStagePanelProps>) {
  const [confirming, setConfirming] = useState(false);
  const [limit, setLimit] = useState(summary.revisionLimit);
  const start = async () => {
    const done = await run(() => api.startDevelopment(projectId, clientId, { operationId: newOperationId(), revisionLimit: limit }),
      'Development was not started. Try again.');
    if (done) setConfirming(false);
  };
  const close = () => { if (!busy) setConfirming(false); };
  return <>
    <Button type="button" size="sm" disabled={busy} aria-haspopup="dialog"
      onClick={() => { setLimit(summary.revisionLimit); setConfirming(true); }}>Start development</Button>
    <Modal isOpen={confirming} onClose={close} title="Start development" maxWidth="max-w-md"
      subtitle="Confirm only once you and the client have signed the contract in person."
      footer={<div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="button" disabled={busy} onClick={() => void start()}>Confirm and start</Button>
      </div>}>
      <div className="space-y-3">
        <label className="block space-y-1"><span className={label}>Revision rounds included in the contract</span>
          <Input type="number" min={0} max={20} value={limit} disabled={busy}
            onChange={event => setLimit(rounds(event.target.value))} className="h-8 w-24" /></label>
        <p className="text-xs text-content-muted">Feedback rounds beyond this number may cost extra.</p>
        {actionError && <p role="alert" className="text-xs text-status-danger">{actionError}</p>}
      </div>
    </Modal>
  </>;
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
