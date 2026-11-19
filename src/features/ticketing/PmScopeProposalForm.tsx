import { useState } from 'react';
import { input, primary, secondary } from './ticketUi';

export interface PmScopeProposalDraft {
  publicSummary: string;
  developerBrief: string;
  /** 'skipped' means the PM chose to start without the client's approval. */
  clientApproval: 'required' | 'skipped';
}

export function PmScopeProposalForm({ disabled, existingScopeAgreed, onCancel, onSubmit }: {
  disabled: boolean;
  existingScopeAgreed: boolean;
  onCancel: () => void;
  onSubmit: (draft: PmScopeProposalDraft) => void;
}) {
  const [askClient, setAskClient] = useState(true);
  return <form className="space-y-4 rounded-xl border border-divider bg-selected p-4" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      publicSummary: String(data.get('publicSummary') ?? ''),
      developerBrief: String(data.get('developerBrief') ?? ''),
      clientApproval: askClient ? 'required' : 'skipped',
    });
  }}>
    <div>
      <h3 className="text-sm font-medium text-content">{existingScopeAgreed ? 'Replace the plan' : 'Send the client a plan'}</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
        The client sees the plan. The developer notes stay private and go only to the developer once work starts.
      </p>
      {existingScopeAgreed && <p className="mt-2 rounded-md border border-status-warning-border bg-status-warning-subtle p-2 text-[10px] leading-relaxed text-status-warning">
        This replaces the approved plan. Work can only start again once the new plan is approved.
      </p>}
    </div>
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-content-secondary">Plan for the client</span>
      <textarea name="publicSummary" required maxLength={4000} rows={3} disabled={disabled}
        placeholder="What will be delivered, in clear terms?" className={`${input} min-h-20 resize-y`} />
    </label>
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-content-secondary">Private notes for the developer</span>
      <textarea name="developerBrief" required maxLength={12000} rows={5} disabled={disabled}
        placeholder="Implementation details, constraints, and checks…" className={`${input} min-h-28 resize-y`} />
    </label>
    <label className="flex items-start gap-2 rounded-lg border border-divider p-3 text-xs text-content-secondary">
      <input type="checkbox" checked={askClient} disabled={disabled} onChange={event => setAskClient(event.target.checked)} className="mt-0.5 accent-violet-500" />
      <span><span className="font-medium text-content">Ask the client to approve this plan first</span>
        <span className="mt-0.5 block text-[11px] text-content-muted">{askClient
          ? 'Work starts after they approve it.'
          : 'You can start right away. The client still sees the plan, marked as approved by you.'}</span></span>
    </label>
    <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-3">
      <button type="button" onClick={onCancel} disabled={disabled} className={secondary}>Cancel</button>
      <button type="submit" disabled={disabled} className={primary}>{askClient ? 'Send plan for approval' : 'Send plan and get ready to start'}</button>
    </div>
  </form>;
}
