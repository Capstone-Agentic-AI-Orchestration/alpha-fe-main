import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { CLASSIFICATION_LABEL, RoundHistory } from './ClientDevelopmentStage';
import { stageDay } from './PocScopeView';
import type { PmStagePanelProps } from './PmStagePanel';
import { extraRounds, revisionAllowance, type RevisionClassification, type RevisionRound } from './projectStages';

const newOperationId = () => crypto.randomUUID();
const label = 'text-[11.5px] font-medium text-content-secondary';
const CHOICES: RevisionClassification[] = ['revision', 'fix', 'out_of_scope'];
const CHOICE_HINT: Record<RevisionClassification, string> = {
  revision: 'A change to agreed work. Counts the round.',
  fix: 'Doesn’t work, or doesn’t match the approved POC. Never counts.',
  out_of_scope: 'New work outside the contract. Becomes a change request for you to answer.',
};

/** Development on the PM side: share builds, label each round's notes, and hand over the final delivery. */
export function PmDevelopmentStage(props: Readonly<PmStagePanelProps>) {
  const { summary } = props;
  const active = summary.rounds.find(round => round.status !== 'classified') ?? null;
  const past = summary.rounds.filter(round => round.status === 'classified');
  const finalWaiting = summary.final && !summary.final.acceptedAt ? summary.final : null;
  return <div className="space-y-5">
    <p className="text-content-secondary">{revisionAllowance(summary)}{extraRounds(summary) ? ' (each extra round costs the client additional)' : ''}.</p>
    {active?.status === 'open' && <p className="text-content-secondary">Build {active.number} is with the client for feedback
      ({active.items.length} note{active.items.length === 1 ? '' : 's'} so far).</p>}
    {active?.status === 'submitted' && <RoundClassifier key={active.id} {...props} round={active} />}
    {!active && finalWaiting && <p className="text-content-secondary">Final delivery marked {stageDay(finalWaiting.deliveredAt)}. Waiting for the client
      to accept it. Sharing another build takes it back.</p>}
    {!active && <ShareBuild {...props} />}
    {!active && !finalWaiting && <FinalDeliveryForm {...props} />}
    {past.length > 0 && <RoundHistory rounds={past} />}
  </div>;
}

function ShareBuild({ api, projectId, clientId, busy, run }: Readonly<PmStagePanelProps>) {
  const [note, setNote] = useState('');
  const share = async () => {
    const done = await run(() => api.shareBuild(projectId, clientId, { operationId: newOperationId(), note: note.trim() }),
      'The build was not shared. Try again.');
    if (done) setNote('');
  };
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); void share(); }}>
    <h3 className="text-[13px] font-semibold text-content">Share a build for feedback</h3>
    <p className="text-[12px] text-content-muted">Opens the next feedback round, linked to the preview the client can see now.</p>
    <label className="block space-y-1"><span className={label}>What changed (optional)</span>
      <Textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={4000} /></label>
    <Button type="submit" size="sm" disabled={busy}>Share build</Button>
  </form>;
}

function FinalDeliveryForm({ api, projectId, clientId, busy, run }: Readonly<PmStagePanelProps>) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  if (!open) return <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setOpen(true)}>Mark final delivery</Button>;
  const deliver = async () => {
    const done = await run(() => api.markFinalDelivery(projectId, clientId, { operationId: newOperationId(), note: note.trim() }),
      'The final delivery was not saved. Try again.');
    if (done) setOpen(false);
  };
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); void deliver(); }}>
    <h3 className="text-[13px] font-semibold text-content">Final delivery</h3>
    <p className="text-[12px] text-content-muted">The client is asked to accept the agreed deliverables. Accepting closes the contract.</p>
    <label className="block space-y-1"><span className={label}>Note to the client (optional)</span>
      <Textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={4000} /></label>
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={busy}>Ask the client to accept</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  </form>;
}

function RoundClassifier({ api, projectId, clientId, busy, run, round }: Readonly<PmStagePanelProps & { round: RevisionRound }>) {
  const [labels, setLabels] = useState<Record<string, { classification: RevisionClassification | null; pmNote: string }>>(
    () => Object.fromEntries(round.items.map(item => [item.id, { classification: null, pmNote: '' }])));
  const complete = round.items.every(item => labels[item.id]?.classification);
  const counts = round.items.some(item => labels[item.id]?.classification === 'revision');
  const save = () => void run(() => api.classifyRound(projectId, clientId, round.id, { operationId: newOperationId(),
    items: round.items.map(item => ({ id: item.id, classification: labels[item.id]!.classification!, pmNote: labels[item.id]!.pmNote.trim() })) }),
  'The labels were not saved. Try again.');
  const set = (itemId: string, patch: Partial<{ classification: RevisionClassification | null; pmNote: string }>) =>
    setLabels(current => ({ ...current, [itemId]: { ...current[itemId]!, ...patch } }));
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); save(); }}>
    <div>
      <h3 className="text-[13px] font-semibold text-content">Feedback round {round.number}</h3>
      <p className="mt-1 text-[12px] text-content-muted">Sent {stageDay(round.submittedAt)}. Label each change. The round counts only if one is a revision.
        {round.extra ? ' This is an extra round: the client confirmed it costs additional.' : ''}</p>
    </div>
    <ol className="space-y-4">
      {round.items.map((item, index) => <li key={item.id} className="space-y-2 border-l-2 border-divider pl-3">
        <p className="whitespace-pre-wrap text-content">{index + 1}. {item.body}</p>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">Label for change {index + 1}</legend>
          {CHOICES.map(choice => <label key={choice} title={CHOICE_HINT[choice]}
            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[12px] font-medium ${labels[item.id]?.classification === choice
              ? 'border-transparent bg-selected text-selected-content' : 'border-divider text-content-secondary hover:bg-surface-high'}`}>
            <input type="radio" className="sr-only" name={`label-${item.id}`} value={choice} checked={labels[item.id]?.classification === choice}
              onChange={() => set(item.id, { classification: choice })} />{CLASSIFICATION_LABEL[choice]}
          </label>)}
        </fieldset>
        <Input aria-label={`Note to the client about change ${index + 1}`} value={labels[item.id]?.pmNote ?? ''} maxLength={2000}
          onChange={event => set(item.id, { pmNote: event.target.value })} placeholder="Note to the client (optional)" className="h-8 text-[12.5px]" />
      </li>)}
    </ol>
    <p className="text-[12px] text-content-muted">{complete ? (counts ? 'This round will count as one revision round.' : 'This round won’t count.')
      : 'Label every change to save.'}</p>
    <Button type="submit" size="sm" disabled={busy || !complete}>Save labels</Button>
  </form>;
}
