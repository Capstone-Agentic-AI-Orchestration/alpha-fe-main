import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { stageDay } from './stageDates';
import type { ClientStagePanelProps } from './ClientStagePanel';
import type { PmStagePanelProps } from './PmStagePanel';
import { COSTS_EXTRA, REQUEST_STATUS_LABEL, type ChangeRequest, type StageSummary } from './projectStages';
import './projectStages.css';

/**
 * Change requests: work outside the contract. Alpha takes no payments, so
 * there is no price here: the client is reminded the work costs additional,
 * and the PM answers "will do" or "won't do".
 */

const newOperationId = () => crypto.randomUUID();

function origin(request: ChangeRequest, rounds: StageSummary['rounds'], role: 'client' | 'pm'): string {
  if (request.requestedBy === 'client') return role === 'client' ? 'You asked' : 'Asked by the client';
  const round = rounds.find(item => item.id === request.roundId);
  return round ? `From feedback round ${round.number}` : 'Raised by the project manager';
}

/** The client's change requests, and the way to ask for new work outside the contract. */
export function ClientRequests({ api, project, summary, busy, readOnly = false, run }: Readonly<ClientStagePanelProps>) {
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const ask = async () => {
    const done = await run(() => api.requestChange(project.workspaceId, project.projectId,
      { operationId: newOperationId(), title: title.trim(), description: description.trim() }), 'Your request was not sent. Try again.');
    if (done) { setAsking(false); setTitle(''); setDescription(''); }
  };
  return <div className="ps-requests">
    {summary.requests.length > 0 && <h4 className="ps-section-title">Change requests</h4>}
    {summary.requests.map(request => <div key={request.id} className="ps-request-row">
      <p className="ps-lead"><strong>{request.title}</strong> <span className={`ps-label is-${request.status}`}>{REQUEST_STATUS_LABEL[request.status]}</span></p>
      {request.description && request.description !== request.title && <p className="ps-copy">{request.description}</p>}
      <p className="ps-hint">{origin(request, summary.rounds, 'client')} {stageDay(request.requestedAt)}
        {request.status === 'will_do' ? ` · ${COSTS_EXTRA}` : ''}</p>
      {request.reply && <blockquote className="ps-reply">{request.reply}</blockquote>}
    </div>)}
    {!readOnly && (asking
      ? <form className="ps-form" onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label className="ps-field"><span>What would you like added or changed?</span>
          <input value={title} onChange={event => setTitle(event.target.value)} maxLength={300} disabled={busy} autoFocus /></label>
        <label className="ps-field"><span>Details (optional)</span>
          <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={8000} disabled={busy} /></label>
        <p className="ps-note">Work outside your contract costs additional and is billed separately. The project manager will tell you whether they can take it on.</p>
        <div className="ps-actions">
          <button type="submit" className="ps-button is-primary" disabled={busy || !title.trim()}>Send request</button>
          <button type="button" className="ps-button" disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
        </div>
      </form>
      : <button type="button" className="ps-link" onClick={() => setAsking(true)}>Request new work</button>)}
  </div>;
}

/** The PM's change requests: answer each open one with "will do" or "won't do". */
export function PmRequests({ api, projectId, clientId, summary, busy, run }: Readonly<PmStagePanelProps>) {
  if (!summary.requests.length) return null;
  return <section className="space-y-3">
    <h3 className="text-[13px] font-semibold text-content">Change requests</h3>
    <p className="text-[12.5px] text-content-muted">Work outside the contract. The client has been told it costs additional; nothing is charged in Alpha.</p>
    {summary.requests.map(request => <div key={request.id} className="space-y-2 border-l-2 border-divider pl-3">
      <p className="text-content"><strong>{request.title}</strong>{' '}
        <span className="text-content-muted">· {origin(request, summary.rounds, 'pm')} {stageDay(request.requestedAt)}</span></p>
      {request.description && request.description !== request.title
        && <p className="whitespace-pre-wrap text-[12.5px] text-content-secondary">{request.description}</p>}
      {request.status === 'open'
        ? <AnswerForm key={request.id} busy={busy} onAnswer={(decision, reply) => run(() =>
          api.answerRequest(projectId, clientId, request.id, { operationId: newOperationId(), decision, reply }), 'Your answer was not saved. Try again.')} />
        : <p className="text-[12.5px] text-content-secondary">{REQUEST_STATUS_LABEL[request.status]}
          {request.answeredAt ? ` · ${stageDay(request.answeredAt)}` : ''}{request.reply ? ` · “${request.reply}”` : ''}</p>}
    </div>)}
  </section>;
}

function AnswerForm({ busy, onAnswer }: Readonly<{ busy: boolean; onAnswer: (decision: 'will_do' | 'wont_do', reply: string) => Promise<boolean> }>) {
  const [reply, setReply] = useState('');
  const answer = (decision: 'will_do' | 'wont_do') => void onAnswer(decision, reply.trim());
  return <div className="space-y-2">
    <label className="block space-y-1"><span className="text-[11.5px] font-medium text-content-secondary">Reply to the client (optional)</span>
      <Textarea value={reply} onChange={event => setReply(event.target.value)} rows={2} maxLength={4000} disabled={busy} /></label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={busy} onClick={() => answer('will_do')}>Will do</Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => answer('wont_do')}>Won’t do</Button>
    </div>
  </div>;
}
