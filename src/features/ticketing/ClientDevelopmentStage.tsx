import { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { stageDay } from './stageDates';
import { SignOffDialog } from './SignOffDialog';
import type { RevisionClassification, RevisionRound } from './projectStages';
import type { ClientStagePanelProps } from './ClientStagePanel';
import './projectStages.css';

const newOperationId = () => crypto.randomUUID();
export const CLASSIFICATION_LABEL: Record<RevisionClassification, string> = { revision: 'Revision', fix: 'Fix', out_of_scope: 'Out of scope' };

/** Development: send feedback on each shared build, see what counted, and accept the final delivery. */
export function ClientDevelopmentStage(props: Readonly<ClientStagePanelProps>) {
  const { summary } = props;
  const active = summary.rounds.find(round => round.status !== 'classified') ?? null;
  const past = summary.rounds.filter(round => round.status === 'classified');
  const finalWaiting = summary.final && !summary.final.acceptedAt ? summary.final : null;
  return <>
    {finalWaiting && <FinalDelivery {...props} note={finalWaiting.note} deliveredAt={finalWaiting.deliveredAt} />}
    {!finalWaiting && active?.status === 'open' && <OpenRound {...props} round={active} />}
    {!finalWaiting && active?.status === 'submitted' && <p className="ps-lead">
      You sent feedback round {active.number} on {stageDay(active.submittedAt)}{active.extra ? ' as an extra round' : ''}. The project manager is reviewing it.</p>}
    {!finalWaiting && !active && <p className="ps-note">The project manager will share the next build here for your feedback.
      Send all your notes on a build together: each round counts once, and fixes don’t count.</p>}
    {past.length > 0 && <RoundHistory rounds={past} />}
  </>;
}

function OpenRound({ api, project, summary, busy, readOnly = false, run, round }: Readonly<ClientStagePanelProps & { round: RevisionRound }>) {
  const [note, setNote] = useState('');
  const [understood, setUnderstood] = useState(false);
  const notes = round.items.map(item => item.body);
  const extra = summary.revisionsUsed >= summary.revisionLimit;
  const save = (items: string[]) => run(() => api.saveRoundItems(project.workspaceId, project.projectId, round.id, items),
    'Your notes were not saved. Try again.');
  const add = async () => {
    const body = note.trim();
    if (!body) return;
    if (await save([...notes, body])) setNote('');
  };
  const submit = () => void run(() => api.submitRound(project.workspaceId, project.projectId, round.id,
    { operationId: newOperationId(), acknowledgeExtra: extra && understood }), 'Your feedback was not sent. Try again.');
  return <>
    <p className="ps-lead">Build {round.number} is ready for your feedback{round.openedAt ? ` (shared ${stageDay(round.openedAt)})` : ''}.</p>
    {round.buildNote && <p className="ps-copy">{round.buildNote}</p>}
    {round.previewUrl && <a className="ps-link ps-inline-link" href={round.previewUrl} target="_blank" rel="noreferrer">
      Open build {round.number} <ExternalLink size={12} aria-hidden="true" /></a>}
    {notes.length > 0 && <ol className="ps-notes">
      {notes.map((body, index) => <li key={index}><span>{body}</span>
        {!readOnly && <button type="button" className="ps-icon-button" disabled={busy} aria-label={`Remove note ${index + 1}`}
          onClick={() => void save(notes.filter((_, position) => position !== index))}><X size={14} aria-hidden="true" /></button>}
      </li>)}
    </ol>}
    {!readOnly && <form className="ps-form" onSubmit={event => { event.preventDefault(); void add(); }}>
      <label className="ps-field">
        <span>Add a change for this round</span>
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={4000} disabled={busy}
          placeholder="e.g. Make the header sticky on mobile" />
      </label>
      <div className="ps-actions"><button type="submit" className="ps-button" disabled={busy || !note.trim()}>Add change</button></div>
    </form>}
    {!readOnly && notes.length > 0 && !extra && <div className="ps-submit">
      <button type="button" className="ps-button is-primary" disabled={busy} onClick={submit}>
        Send round {summary.revisionsUsed + 1} of {summary.revisionLimit}</button>
      <p className="ps-hint">Sends every change above together. It counts as one revision round; fixes for things that don’t work as agreed don’t count.</p>
    </div>}
    {!readOnly && notes.length > 0 && extra && <div className="ps-limit" role="note">
      <p><strong>Your {summary.revisionLimit} included revision rounds are used.</strong> This round is extra and costs additional, billed separately from your contract.
        {' '}Fixes for things that don’t work as agreed still don’t count.</p>
      <label className="ps-consent">
        <input type="checkbox" checked={understood} onChange={event => setUnderstood(event.target.checked)} disabled={busy} />
        <span>I understand this extra round costs additional.</span>
      </label>
      <div className="ps-actions">
        <button type="button" className="ps-button is-primary" disabled={busy || !understood} onClick={submit}>Send extra round</button>
      </div>
    </div>}
  </>;
}

function FinalDelivery({ api, project, busy, readOnly = false, run, note, deliveredAt }: Readonly<ClientStagePanelProps & { note: string; deliveredAt: string }>) {
  const [accepting, setAccepting] = useState(false);
  const accept = async (fullName: string) => {
    const done = await run(() => api.acceptFinal(project.workspaceId, project.projectId, { operationId: newOperationId(), fullName }),
      'Your acceptance was not saved. Try again.');
    if (done) setAccepting(false);
  };
  return <>
    <p className="ps-lead">The project manager marked the project <strong>ready for final acceptance</strong> on {stageDay(deliveredAt)}.</p>
    {note && <p className="ps-copy">{note}</p>}
    <p className="ps-note">Accepting closes the contract. If something still isn’t as agreed, say so in the conversation instead.</p>
    {!readOnly && <div className="ps-actions">
      <button type="button" className="ps-button is-primary" disabled={busy} onClick={() => setAccepting(true)}>Accept final delivery</button>
    </div>}
    {accepting && <SignOffDialog title="Accept the final delivery" busy={busy} confirmLabel="Accept and close"
      consent="I accept the final delivery of the agreed deliverables. This closes the contract."
      onCancel={() => setAccepting(false)} onConfirm={fullName => void accept(fullName)}>
      <p className="ps-copy">After closing, new features or changes outside the agreed scope cost additional and are billed separately.</p>
    </SignOffDialog>}
  </>;
}

/** Earlier rounds, newest first, with what each note was counted as. */
export function RoundHistory({ rounds }: Readonly<{ rounds: RevisionRound[] }>) {
  const [open, setOpen] = useState(false);
  return <div className="ps-history">
    <button type="button" className="ps-link" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      {open ? 'Hide earlier rounds' : `Earlier rounds (${rounds.length})`}</button>
    {open && <ul className="ps-rounds">
      {rounds.map(round => <li key={round.id}>
        <p className="ps-round-title">Round {round.number} · {roundCount(round)}</p>
        <ul className="ps-round-items">
          {round.items.map(item => <li key={item.id}>
            <span className={'ps-label is-' + (item.classification ?? 'none')}>{item.classification ? CLASSIFICATION_LABEL[item.classification] : '—'}</span>
            <span>{item.body}{item.pmNote && <span className="ps-hint"> — {item.pmNote}</span>}</span>
          </li>)}
        </ul>
      </li>)}
    </ul>}
  </div>;
}

/** How a reviewed round counted against the included rounds. */
export function roundCount(round: Pick<RevisionRound, 'counts' | 'extra'>): string {
  if (!round.counts) return 'Not counted';
  return round.extra ? 'Extra round, billed separately' : 'Counted as a revision';
}
