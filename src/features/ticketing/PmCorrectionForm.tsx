import { useEffect, useState } from 'react';
import type { PmTicketDetail } from './pmApi';
import type { PmHandoffIssue } from './pmWorkHandoff';
import { isPmCorrectionCandidate, loadPmReviewIssues, validPmCorrectionSelection, type PmCorrectionDraft, type PmCorrectionMode } from './pmReview';
import { input, primary, secondary } from './ticketUi';

export function PmCorrectionForm({ ticket, mode, disabled, onCancel, onSubmit }: {
  ticket: PmTicketDetail; mode: PmCorrectionMode; disabled: boolean;
  onCancel: () => void; onSubmit: (draft: PmCorrectionDraft) => void;
}) {
  const [issues, setIssues] = useState<PmHandoffIssue[] | null>(null);
  const [issueIds, setIssueIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let current = true;
    setIssues(null); setFailed(false); setIssueIds([]); setConfirmed(false);
    loadPmReviewIssues(ticket).then(value => { if (current) setIssues(value); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [ticket, refresh]);
  const candidates = issues?.filter(issue => isPmCorrectionCandidate(ticket, issue)) ?? [];
  const draft = { issueIds, reason };
  const ready = !disabled && confirmed && issues !== null && validPmCorrectionSelection(ticket, issues, draft);
  const incomplete = issues && ticket.internal.requiredIssueIds.some(id => !issues.some(issue => issue.id === id));
  return <form aria-label="Return affected Issues" className="space-y-4 rounded-xl border border-amber-400/15 bg-amber-500/[0.035] p-4"
    onSubmit={event => { event.preventDefault(); if (ready) onSubmit({ issueIds: [...issueIds], reason: reason.trim() }); }}>
    <div>
      <h3 className="text-sm font-medium text-gray-100">Return affected Issues</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{mode === 'client_feedback' ? 'Review the client’s feedback in the conversation, then describe the agreed correction for the developer.' : 'Select only the reviewed work that needs fixing and explain what the developer should correct.'} Extra scope needs a linked ticket, not a project restart.</p>
    </div>
    {!issues && !failed && <p role="status" className="text-xs text-gray-500">Loading this ticket’s Issues…</p>}
    {(failed || incomplete) && <p role="alert" className="text-xs text-rose-200">{failed ? 'Could not load the ticket’s Issues.' : 'Some linked Issues are no longer available. Refresh and review the ticket before returning work.'}</p>}
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="sr-only">Correction details</legend>
      {issues && <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-white/[0.07] p-2">
        {candidates.length === 0 && <p className="p-2 text-xs text-gray-500">No assigned Issues are ready for correction. Already queued or running work is not restarted.</p>}
        {candidates.map(issue => <label key={issue.id} className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-white/[0.035]">
          <input type="checkbox" className="mt-0.5 accent-brand-500" checked={issueIds.includes(issue.id)} onChange={event => {
            setIssueIds(current => event.target.checked ? [...current, issue.id] : current.filter(id => id !== issue.id)); setConfirmed(false);
          }} />
          <span className="min-w-0 text-xs text-gray-300"><span className="text-[10px] text-gray-500">{issue.identifier}</span> {issue.title}
            <span className="mt-1 block text-[10px] text-gray-500">{issue.status === 'done' ? 'Done' : 'In review'} · {issue.assignedHuman}</span>
          </span>
        </label>)}
      </div>}
      <label className="block space-y-1.5"><span className="text-[11px] font-medium text-gray-300">Developer correction instructions</span>
        <textarea required maxLength={4000} rows={3} className={`${input} min-h-24 resize-y`} value={reason}
          onChange={event => { setReason(event.target.value); setConfirmed(false); }} placeholder="What failed the agreed checks, and what should be corrected?" />
        <span className="block text-[10px] text-gray-500">Shared only with the assigned developer. Client messages and private notes are not copied automatically.</span>
      </label>
      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-100/80">
        <input type="checkbox" className="mt-0.5 accent-brand-500" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
        I reviewed the affected work. Return only these Issues; keep the agreed scope and other work unchanged. Agents will not restart automatically.
      </label>
    </fieldset>
    <div className="flex flex-wrap justify-between gap-2 border-t border-white/[0.06] pt-3">
      <button type="button" className={secondary} disabled={disabled || (!issues && !failed)} onClick={() => setRefresh(value => value + 1)}>Refresh Issues</button>
      <div className="flex gap-2"><button type="button" onClick={onCancel} disabled={disabled} className={secondary}>Cancel</button>
        <button type="submit" disabled={!ready} className={primary}>Return selected Issues</button></div>
    </div>
  </form>;
}
