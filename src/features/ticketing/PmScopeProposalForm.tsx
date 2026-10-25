import { input, primary, secondary } from './ticketUi';

export interface PmScopeProposalDraft {
  publicSummary: string;
  developerBrief: string;
}

export function PmScopeProposalForm({ disabled, existingScopeAgreed, onCancel, onSubmit }: {
  disabled: boolean;
  existingScopeAgreed: boolean;
  onCancel: () => void;
  onSubmit: (draft: PmScopeProposalDraft) => void;
}) {
  return <form className="space-y-4 rounded-xl border border-divider bg-selected p-4" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      publicSummary: String(data.get('publicSummary') ?? ''),
      developerBrief: String(data.get('developerBrief') ?? ''),
    });
  }}>
    <div>
      <h3 className="text-sm font-medium text-content">Propose the work scope</h3>
      <p className="mt-1 text-[11px] leading-relaxed text-content-muted">
        The client sees the summary and must agree before work can be authorized. The developer brief stays internal and is shared only with an assigned developer after authorization.
      </p>
      {existingScopeAgreed && <p className="mt-2 rounded-md border border-status-warning-border bg-status-warning-subtle p-2 text-[10px] leading-relaxed text-status-warning">
        Replacing the agreed scope will cancel that agreement and ask the client to review this new version.
      </p>}
    </div>
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-content-secondary">Client-facing summary</span>
      <textarea name="publicSummary" required maxLength={4000} rows={3} disabled={disabled}
        placeholder="What will be delivered, in clear terms?" className={`${input} min-h-20 resize-y`} />
    </label>
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium text-content-secondary">Internal developer brief</span>
      <textarea name="developerBrief" required maxLength={12000} rows={5} disabled={disabled}
        placeholder="Implementation details, constraints, and acceptance checks…" className={`${input} min-h-28 resize-y`} />
    </label>
    <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-3">
      <button type="button" onClick={onCancel} disabled={disabled} className={secondary}>Cancel</button>
      <button type="submit" disabled={disabled} className={primary}>{existingScopeAgreed ? 'Replace scope & request new agreement' : 'Send scope for client agreement'}</button>
    </div>
  </form>;
}
