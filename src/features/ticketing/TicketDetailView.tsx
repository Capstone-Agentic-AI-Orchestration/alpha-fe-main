import { useState } from 'react';
import { ArrowLeft, ChevronRight, FileText, FolderKanban, LockKeyhole, Mail, Plus } from 'lucide-react';
import { PREVIEW_STAGES } from './previewModel';
import type { ClientTicketView, PmTicketView, PreviewRole, PreviewStage, TicketPreview } from './previewModel';
import { TicketConversation } from './TicketConversation';
import { TicketStatusBadge } from './TicketStatusBadge';
import { input, panels, secondary, time } from './ticketUi';
import type { DetailPanel } from './ticketUi';

function PendingPanel({ panel, role }: { panel: Exclude<DetailPanel, 'Conversation'>; role: PreviewRole }) {
  const content = {
    Scope: { title: 'No agreed scope yet', description: 'The PM proposes the work here. Client agreement and PM permission to start are separate decisions.', action: role === 'pm' ? 'Propose scope' : 'Agree to scope' },
    Documents: { title: 'No documents attached', description: 'Document versions stay with this ticket. A changed document is a proposal, not an instruction to restart ongoing work.', action: 'Upload document' },
    Delivery: { title: 'No reviewed result shared', description: 'The PM reviews developer work before sharing a specific result. Client acceptance, ticket closure and project completion are separate.', action: role === 'pm' ? 'Share reviewed result' : 'Accept shared result' },
  }[panel];
  return <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
    <FileText size={26} className="mx-auto mb-4 text-gray-600" /><h3 className="text-sm font-medium text-gray-200">{content.title}</h3>
    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-500">{content.description}</p>
    <button disabled className={`${secondary} mt-5`} aria-describedby="pending-service"><LockKeyhole size={14} />{content.action}</button>
    <p id="pending-service" className="mt-3 text-[11px] text-gray-500">Requires the connected ticket service. Not simulated or queued in this UI preview.</p>
  </div>;
}

export function TicketDetailView({ ticket, role, model, refresh, onBack, onExtra }: {
  ticket: ClientTicketView | PmTicketView; role: PreviewRole; model: TicketPreview;
  refresh: () => void; onBack: () => void; onExtra: () => void;
}) {
  const [panel, setPanel] = useState<DetailPanel>('Conversation');
  const [scene, setScene] = useState<PreviewStage>(() => (Object.keys(PREVIEW_STAGES) as PreviewStage[]).find(value => {
    const stage = PREVIEW_STAGES[value];
    return stage.status === ticket.status && stage.owner === ticket.actionOwner;
  }) ?? 'received');
  const publicInquiry = role === 'pm' && 'inquiry' in ticket ? ticket.inquiry : undefined;
  const inquiryAction = ticket.status === 'Received' ? 'Mark under review'
    : ticket.status === 'Under review' ? 'Issue client invitation' : null;
  return <section className="min-w-0 flex-1 overflow-y-auto p-5 md:p-7">
    <button onClick={onBack} className="mb-5 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"><ArrowLeft size={14} />{role === 'pm' ? 'All tickets' : 'My Tickets'}</button>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-gray-500">{ticket.reference}</span><TicketStatusBadge ticket={ticket} /></div>
        <h2 className="break-words text-xl font-semibold text-white">{ticket.title}</h2>
        <p className="mt-2 text-[11px] text-gray-500">Created {time(ticket.createdAt)} · Latest client-visible update {time(ticket.updatedAt)}</p>
      </div>
      {role === 'client' && <button className={secondary} onClick={onExtra}><Plus size={14} />Request additional work</button>}
    </div>
    {ticket.relatedTicketId && <p className="mt-3 text-xs text-brand-300">Linked follow-up request · tracked separately from the original ticket.</p>}
    {publicInquiry && <section className="my-5 rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-200"><Mail size={15} className="text-amber-300" />Public inquiry · no client account yet</div>
      <p className="mt-3 text-sm text-gray-200">{publicInquiry.contact.fullName} · {publicInquiry.contact.email}</p>
      {publicInquiry.contact.company && <p className="mt-1 text-xs text-gray-400">{publicInquiry.contact.company}</p>}
      {publicInquiry.requestedDeadline && <p className="mt-2 text-xs text-gray-400">Requested target date: {publicInquiry.requestedDeadline} <span className="text-gray-500">(not a commitment)</span></p>}
      <p className="mt-3 text-xs leading-relaxed text-amber-100/70">Email is unverified and is not proof of identity or ticket access. Account activation must verify the address and bind the client to this same ticket.</p>
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/10 p-3">
        <p className="text-[11px] font-medium text-gray-300">PM intake sequence</p>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">Review the inquiry first. If it is suitable, issue a separate invitation. Invitation does not approve project scope or authorize development work.</p>
        {inquiryAction && <button disabled className={`${secondary} mt-3`} title="The connected ticket service is not available in this preview"><LockKeyhole size={14} />{inquiryAction}</button>}
        {!inquiryAction && <p className="mt-3 text-[11px] text-gray-500">No intake action is available at this ticket stage.</p>}
        <p className="mt-2 text-[10px] text-gray-600">Preview only: no invitation was created or email sent.</p>
      </div>
    </section>}
    <div className="my-5 flex items-start gap-3 rounded-xl border border-brand-400/15 bg-brand-500/[0.04] p-4">
      <span className="mt-0.5 rounded-md bg-brand-500/10 p-1.5 text-brand-300"><ChevronRight size={16} /></span>
      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Next step · {ticket.actionOwner === 'none' ? 'No action required' : ticket.actionOwner === 'pm' ? 'Project Manager' : ticket.actionOwner === 'client' ? 'Client' : 'Developer'}</p>
        <p className="mt-1 text-sm text-gray-200">{ticket.nextAction}</p></div>
    </div>
    <div className="mb-5 rounded-xl border border-white/[0.07] bg-surface p-4"><h3 className="mb-2 text-xs font-medium text-gray-400">Original request</h3><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{ticket.description}</p></div>
    {publicInquiry ? <div className="space-y-5">
      <div className="rounded-xl border border-dashed border-white/10 px-5 py-7 text-center">
        <LockKeyhole size={22} className="mx-auto mb-3 text-gray-500" />
        <p className="text-sm text-gray-300">No client conversation yet</p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-gray-500">Before account activation, keep this as an inquiry for PM review. A ticket conversation starts only after the verified client is granted access to this same ticket.</p>
      </div>
      <section className="rounded-xl border border-amber-400/15 bg-amber-500/[0.025] p-4">
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-xs font-medium text-gray-200"><LockKeyhole size={14} className="text-amber-300" />Internal inquiry notes</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">For PM triage only. These notes are not sent to the unverified contact and are not a client conversation.</p>
        </div>
        <TicketConversation key={`${ticket.id}-${role}-inquiry-notes`} ticket={ticket} role="pm" notesOnly onMessage={(body) => { model.message(ticket.id, 'pm', body, true); refresh(); }} />
      </section>
    </div> : <>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/[0.07]" aria-label="Ticket sections">
        {panels.map(value => <button key={value} aria-pressed={panel === value} onClick={() => setPanel(value)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-medium ${panel === value ? 'border-brand-400 text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{value}</button>)}
      </div>
      {panel === 'Conversation' ? <TicketConversation key={`${ticket.id}-${role}`} ticket={ticket} role={role} onMessage={(body, privateNote) => { model.message(ticket.id, role, body, privateNote); refresh(); }} /> : <PendingPanel panel={panel} role={role} />}
    </>}
    {role === 'pm' && !publicInquiry && <section className="mt-6 rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-300"><FolderKanban size={15} />Internal work connection</div>
      <p className="my-2 text-xs leading-relaxed text-gray-500">No project or Issues linked. Work will use existing Projects and Issues after scope agreement and PM authorization—not another execution engine.</p>
      <button disabled className={secondary} title="Requires connected ticket service">Link project and assign Issues</button>
    </section>}
    {!publicInquiry && <details className="mt-6 rounded-xl border border-dashed border-amber-400/20 bg-amber-500/[0.02] p-4">
      <summary className="cursor-pointer text-xs font-medium text-amber-200/80">UI rehearsal controls · not business actions</summary>
      <p className="mt-3 text-[11px] leading-relaxed text-gray-500">Select a scene to inspect the layout and read-only states. This records no agreement, approval, acceptance, release or real status change.</p>
      <div className="mt-3 flex flex-wrap gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Preview scene</span><select className={input} value={scene} onChange={event => setScene(event.target.value as PreviewStage)}>{Object.entries(PREVIEW_STAGES).map(([value, setting]) => <option key={value} value={value}>{setting.label}</option>)}</select></label>
        <button className={secondary} onClick={() => { model.setScene(ticket.id, scene); refresh(); }}>Show scene</button></div>
    </details>}
  </section>;
}
