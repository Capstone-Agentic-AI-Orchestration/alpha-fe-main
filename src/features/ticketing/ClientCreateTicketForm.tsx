import { useRef, useState } from 'react';
import { ArrowLeft, Plus, ShieldCheck, Ticket } from 'lucide-react';

import type { ClientTicketCreateInput, ClientTicketIntakeContext } from './clientApi';
import { input, primary, secondary } from './ticketUi';

type ProjectPreference = 'not_sure' | 'new_project' | 'shared_project';

export function ClientCreateTicketForm({
  context, relatedTicket, busy, error, onCreate, onCancel, submissionEnabled = true,
}: {
  context: ClientTicketIntakeContext;
  relatedTicket: { id: string; reference: string; title: string } | null;
  busy: boolean;
  error: string;
  onCreate: (value: ClientTicketCreateInput) => void;
  onCancel: () => void;
  submissionEnabled?: boolean;
}) {
  const operationId = useRef(crypto.randomUUID());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [projectPreference, setProjectPreference] = useState<ProjectPreference>('not_sure');
  const [projectOptionId, setProjectOptionId] = useState('');

  function edited() {
    if (!busy) operationId.current = crypto.randomUUID();
  }

  if (!context.canCreate) return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} className="mb-6 inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white"><ArrowLeft size={14} />My Tickets</button>
    <div className="rounded-xl border border-white/[0.08] bg-surface p-6">
      <h1 className="text-lg font-semibold text-white">New request unavailable</h1>
      <p className="mt-2 text-sm text-gray-400">Your current client access does not allow a new request in this workspace. Contact your project manager if you think this is a mistake.</p>
    </div>
  </section>;

  return <section className="mx-auto w-full max-w-2xl p-5 md:p-10">
    <button onClick={onCancel} disabled={busy} className="mb-6 inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white disabled:opacity-50"><ArrowLeft size={14} />My Tickets</button>
    <div className="mb-7 flex items-start gap-3">
      <span className="rounded-xl border border-brand-400/20 bg-brand-500/10 p-3 text-brand-300"><Ticket size={22} /></span>
      <div><h1 className="text-2xl font-semibold text-white">{relatedTicket ? 'Request additional work' : 'New request'}</h1>
        <p className="mt-1 text-sm text-gray-400">Your project manager will review it before any work is scheduled.</p></div>
    </div>
    <form className="space-y-5 rounded-xl border border-white/[0.08] bg-surface p-5 md:p-7" onSubmit={event => {
      event.preventDefault();
      if (!submissionEnabled || busy) return;
      const project = projectPreference === 'shared_project' && projectOptionId
        ? { kind: 'shared_project' as const, optionId: projectOptionId }
        : { kind: projectPreference === 'new_project' ? 'new_project' as const : 'not_sure' as const };
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
      {relatedTicket && <p className="rounded-lg border border-brand-400/20 bg-brand-500/5 p-3 text-xs text-brand-300">This will be a separate request, linked to {relatedTicket.reference} · {relatedTicket.title}. The existing work stays unchanged.</p>}
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Title <span className="text-gray-500">(required)</span></span>
        <input className={input} required maxLength={160} value={title} disabled={busy} onChange={event => { edited(); setTitle(event.target.value); }} placeholder="What do you need?" /></label>
      <label className="block space-y-2"><span className="text-xs font-medium text-gray-300">Details <span className="text-gray-500">(required)</span></span>
        <textarea className={`${input} min-h-36 resize-y`} required maxLength={6000} value={description} disabled={busy} onChange={event => { edited(); setDescription(event.target.value); }} placeholder="Describe the outcome you need and any useful context." /></label>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-300">Which project is this for?</legend>
        <label className="flex items-center gap-2 text-xs text-gray-400"><input type="radio" name="project-preference" checked={projectPreference === 'not_sure'} disabled={busy} onChange={() => { edited(); setProjectPreference('not_sure'); }} />I’m not sure yet</label>
        <label className="flex items-center gap-2 text-xs text-gray-400"><input type="radio" name="project-preference" checked={projectPreference === 'new_project'} disabled={busy} onChange={() => { edited(); setProjectPreference('new_project'); }} />This may need a new project</label>
        {context.sharedProjects.length > 0 && <label className="flex items-center gap-2 text-xs text-gray-400"><input type="radio" name="project-preference" checked={projectPreference === 'shared_project'} disabled={busy} onChange={() => { edited(); setProjectPreference('shared_project'); setProjectOptionId(current => current || context.sharedProjects[0].optionId); }} />Connect it to a project my PM shared</label>}
        {projectPreference === 'shared_project' && context.sharedProjects.length > 0 && <select className={input} value={projectOptionId} disabled={busy} onChange={event => { edited(); setProjectOptionId(event.target.value); }}>
          {context.sharedProjects.map(project => <option key={project.optionId} value={project.optionId}>{project.displayName}</option>)}
        </select>}
        <p className="text-[10px] text-gray-600">This is a preference for the PM, not approval to begin work.</p>
      </fieldset>
      <label className="block max-w-xs space-y-2"><span className="text-xs font-medium text-gray-300">Requested date <span className="text-gray-500">(optional, not guaranteed)</span></span>
        <input className={input} type="date" value={deadline} disabled={busy} onChange={event => { edited(); setDeadline(event.target.value); }} /></label>
      <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-gray-400"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-gray-500" />
        <p>Submitting asks the PM to review the request. It does not automatically create a project, assign a developer, or start AI work.</p></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <p className="max-w-xs text-[11px] text-gray-500">{submissionEnabled ? 'Only share information needed to describe the request. Documents are handled separately.' : 'UI inspection only. You can fill this form, but submission and document uploads are not enabled.'}</p>
        <div className="flex gap-2"><button type="button" onClick={onCancel} disabled={busy} className={secondary}>Cancel</button><button className={primary} type="submit" disabled={!submissionEnabled || busy || (projectPreference === 'shared_project' && !projectOptionId)}><Plus size={15} />{busy ? 'Submitting…' : 'Submit request'}</button></div>
      </div>
    </form>
  </section>;
}
