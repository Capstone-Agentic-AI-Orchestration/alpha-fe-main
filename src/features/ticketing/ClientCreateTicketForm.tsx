import { useRef, useState } from 'react';
import { ArrowLeft, Plus, ShieldCheck, Ticket } from 'lucide-react';

import type { ClientTicketCreateInput, ClientTicketIntakeContext } from './clientApi';
import { input, primary, secondary } from './ticketUi';

type ProjectPreference = 'not_sure' | 'new_project' | 'shared_project';

export function ClientCreateTicketForm({
  context, relatedTicket, busy, error, onCreate, onCancel, submissionEnabled = true,
  selectedProjectOptionId, selectedProjectName,
}: {
  context: ClientTicketIntakeContext;
  relatedTicket: { id: string; reference: string; title: string } | null;
  busy: boolean;
  error: string;
  onCreate: (value: ClientTicketCreateInput) => void;
  onCancel: () => void;
  submissionEnabled?: boolean;
  /** Opaque optionId returned by the selected project and revalidated by intake-context. */
  selectedProjectOptionId?: string;
  selectedProjectName?: string;
}) {
  const operationId = useRef(crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [projectPreference, setProjectPreference] = useState<ProjectPreference>('not_sure');
  const [projectOptionId, setProjectOptionId] = useState('');
  const pinnedProjectValid = selectedProjectOptionId
    ? context.sharedProjects.some(project => project.optionId === selectedProjectOptionId) : true;
  const effectiveProjectPreference = selectedProjectOptionId ? 'shared_project' : projectPreference;
  const effectiveProjectOptionId = selectedProjectOptionId ?? projectOptionId;

  function edited() {
    if (!busy) operationId.current = crypto.randomUUID();
  }

  if (!context.canCreate) return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} className="mb-6 inline-flex items-center gap-2 text-xs text-content-secondary hover:text-content"><ArrowLeft size={14} />My Tickets</button>
    <div className="rounded-xl border border-divider bg-surface p-6">
      <h1 className="text-lg font-semibold text-content">New request unavailable</h1>
      <p className="mt-2 text-sm text-content-secondary">Your current client access does not allow a new request in this workspace. Contact your project manager if you think this is a mistake.</p>
    </div>
  </section>;

  return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} disabled={busy} className="mb-6 inline-flex items-center gap-2 text-xs text-content-secondary hover:text-content disabled:opacity-50"><ArrowLeft size={14} />My Tickets</button>
    <div className="mb-7 flex items-start gap-3">
      <span className="rounded-xl border border-divider bg-selected p-3 text-selected-content"><Ticket size={22} /></span>
      <div><h1 className="text-2xl font-semibold text-content">{relatedTicket ? 'Request additional work' : 'New request'}</h1>
        <p className="mt-1 text-sm text-content-secondary">Your project manager will review it before any work is scheduled.</p></div>
    </div>
    <form className="space-y-5 rounded-xl border border-divider bg-surface p-5 md:p-7" onSubmit={event => {
      event.preventDefault();
      if (!submissionEnabled || busy) return;
      if (selectedProjectOptionId && !pinnedProjectValid) return;
      const project = effectiveProjectPreference === 'shared_project' && effectiveProjectOptionId
        ? { kind: 'shared_project' as const, optionId: effectiveProjectOptionId }
        : { kind: effectiveProjectPreference === 'new_project' ? 'new_project' as const : 'not_sure' as const };
      const payload: ClientTicketCreateInput = {
        intakeContextId: context.intakeContextId,
        schemaVersion: 1,
        operationId: operationId.current,
        title,
        description,
        ...(relatedTicket ? { relatedTicketId: relatedTicket.id } : {}),
        projectPreference: project,
        requestedDeadline: deadline || null,
      };
      onCreate(payload);
    }}>
      {relatedTicket && <p className="rounded-lg border border-divider bg-selected p-3 text-xs text-selected-content">This will be a separate request, linked to {relatedTicket.reference} · {relatedTicket.title}. The existing work stays unchanged.</p>}
      <label className="block space-y-2"><span className="text-xs font-medium text-content-secondary">Title <span className="text-content-muted">(required)</span></span>
        <input className={input} required maxLength={160} value={title} disabled={busy} onChange={event => { edited(); setTitle(event.target.value); }} placeholder="What do you need?" /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-content-secondary">Details <span className="text-content-muted">(required)</span></span>
        <textarea className={`${input} min-h-36 resize-y`} required maxLength={6000} value={description} disabled={busy} onChange={event => { edited(); setDescription(event.target.value); }} placeholder="Describe the outcome you need and any useful context." /></label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-content-secondary">Which project is this for?</legend>
        {selectedProjectOptionId ? <>
          <p className="text-xs text-content-secondary">{selectedProjectName || 'Selected project'}</p>
          {!pinnedProjectValid && <p role="alert" className="text-xs text-status-danger">This project is no longer available for requests. Go back to Projects and refresh.</p>}
        </> : <>
          <label className="flex items-center gap-2 text-xs text-content-secondary"><input type="radio" name="project-preference" checked={projectPreference === 'not_sure'} disabled={busy} onChange={() => { edited(); setProjectPreference('not_sure'); }} />I’m not sure yet</label>
          <label className="flex items-center gap-2 text-xs text-content-secondary"><input type="radio" name="project-preference" checked={projectPreference === 'new_project'} disabled={busy} onChange={() => { edited(); setProjectPreference('new_project'); }} />This may need a new project</label>
          {context.sharedProjects.length > 0 && <label className="flex items-center gap-2 text-xs text-content-secondary"><input type="radio" name="project-preference" checked={projectPreference === 'shared_project'} disabled={busy} onChange={() => { edited(); setProjectPreference('shared_project'); setProjectOptionId(current => current || context.sharedProjects[0].optionId); }} />I think this is related to a project my PM shared</label>}
          {projectPreference === 'shared_project' && context.sharedProjects.length > 0 && <select className={input} value={projectOptionId} disabled={busy} onChange={event => { edited(); setProjectOptionId(event.target.value); }}>
            {context.sharedProjects.map(project => <option key={project.optionId} value={project.optionId}>{project.displayName}</option>)}
          </select>}
        </>}
        <p className="text-xs text-content-muted">This is a request preference, not a project link or access grant. Your PM must review and link the request.</p>
      </fieldset>
      <label className="block max-w-xs space-y-2"><span className="text-xs font-medium text-content-secondary">Requested date <span className="text-content-muted">(optional, not guaranteed)</span></span>
        <input className={input} type="date" value={deadline} disabled={busy} onChange={event => { edited(); setDeadline(event.target.value); }} /></label>
      <div className="flex items-start gap-2 rounded-lg bg-surface-raised p-3 text-xs leading-relaxed text-content-secondary"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-content-muted" />
        <p>Submitting asks the PM to review the request. It does not automatically create a project, assign a developer, or start AI work.</p></div>
      {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-5">
        <p className="max-w-xs text-xs text-content-muted">{submissionEnabled ? 'Only share information needed to describe the request. Documents are handled separately.' : 'UI inspection only. You can fill this form, but submission and document uploads are not enabled.'}</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} disabled={busy} className={secondary}>Cancel</button><button className={primary} type="submit" disabled={!submissionEnabled || busy || !pinnedProjectValid || (effectiveProjectPreference === 'shared_project' && !effectiveProjectOptionId)}><Plus size={15} />{busy ? 'Submitting…' : 'Submit request'}</button></div>
      </div>
    </form>
  </section>;
}
