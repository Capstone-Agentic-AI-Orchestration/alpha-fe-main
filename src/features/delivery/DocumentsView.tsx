import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { DocStatus, Band, SectionLabel } from '@/features/delivery/Ledger';
import { Send, Paperclip, Check, MessageSquare } from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const {
    requirementDocs,
    sendDocToClient,
    approveScope,
    requestScopeChanges,
    can,
    setActiveTab,
    role,
    projects
  } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(
    requirementDocs.find(d => d.status === 'awaiting_client')?.id ?? requirementDocs[0]?.id ?? null
  );
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');
  const doc = requirementDocs.find(d => d.id === selectedId);
  const project = doc?.projectId ? projects.find(p => p.id === doc.projectId) : undefined;
  const canApprove = role === 'client' && can('approve_scope');

  const handleApprove = () => {
    if (!doc || !canApprove) return;
    const created = approveScope(doc.id);
    if (created) setActiveTab('portal');
  };

  const handleRequestChanges = () => {
    if (!doc || !changeRequest.trim() || !canApprove) return;
    requestScopeChanges(doc.id, changeRequest.trim());
    setChangeRequest('');
    setShowChangeRequest(false);
  };

  return (
    <div className="h-full flex overflow-hidden bg-surface text-sm">

      {/* Roster */}
      <div className="w-72 border-r border-white/[0.06] flex flex-col flex-shrink-0 bg-surface">
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">
            {role === 'client' ? 'My requests' : 'Specifications'}
          </h2>
          <span className="font-mono text-[11px] text-gray-500">{requirementDocs.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
          {requirementDocs.length === 0 && (
            <p className="p-5 text-xs text-gray-500">Nothing here yet.</p>
          )}
          {requirementDocs.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`w-full text-left px-5 py-3.5 space-y-1.5 transition-colors ${
                selectedId === d.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-gray-500">{d.identifier}</span>
                <span className="font-mono text-[11px] text-gray-600">rev {d.version}</span>
              </div>
              <p className="text-xs text-gray-300 truncate">{d.title}</p>
              <DocStatus status={d.status} />
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      {!doc ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select a specification
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-7 px-6 py-7 lg:px-8">

            {/* Head */}
            <div className="space-y-3 pb-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3 font-mono text-[11px] text-gray-500">
                <span>{doc.identifier}</span>
                <span>·</span>
                <span>rev {doc.version}</span>
                {/* A developer builds to the specification; whose account it is
                    is not theirs to know. */}
                {role !== 'dev' && (
                  <>
                    <span>·</span>
                    <span>{doc.company || doc.clientName}</span>
                  </>
                )}
              </div>
              <div className="flex items-start justify-between gap-6">
                <h1 className="text-lg font-semibold text-white tracking-tight">{doc.title}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <DocStatus status={doc.status} />
                {project && (
                  <button
                    onClick={() => setActiveTab('projects')}
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    Built as {project.name}
                  </button>
                )}
              </div>
            </div>

            {/* Problem */}
            <section className="space-y-2.5">
              <SectionLabel>The problem</SectionLabel>
              <p className="text-sm text-gray-300 leading-relaxed">{doc.problemStatement}</p>
            </section>

            {/* Goals */}
            {doc.goals.length > 0 && (
              <section className="space-y-2.5">
                <SectionLabel>Goals</SectionLabel>
                <ul className="space-y-2">
                  {doc.goals.map((g, i) => (
                    <li key={i} className="flex gap-3 text-sm text-gray-300">
                      <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0 mt-2" />
                      <span className="leading-relaxed">{g}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Functional requirements */}
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <SectionLabel>What it must do</SectionLabel>
                <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                  {doc.functionalRequirements.filter(r => r.included).length} included
                </span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {doc.functionalRequirements.map((r, i) => (
                  <div key={r.id} className={`py-3.5 space-y-2 ${r.included ? '' : 'opacity-40'}`}>
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-[11px] text-gray-600 pt-0.5 w-6 flex-shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>

                      {/* Two audiences, one record. The client verifies "is this
                          what I asked for", so their own words lead and the
                          engineering restatement is available but secondary.
                          Staff need the formal statement to build against. */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {role === 'client' ? (
                          <>
                            <p className="text-sm text-gray-200 leading-relaxed">{r.clientWording}</p>
                            <details className="group">
                              <summary className="text-[11px] text-gray-600 cursor-pointer hover:text-gray-400 transition-colors list-none">
                                How our team wrote it up
                              </summary>
                              <p className="text-[11px] text-gray-500 leading-relaxed pt-1.5">
                                {r.requirement}
                              </p>
                            </details>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-gray-200 leading-relaxed">{r.requirement}</p>
                            <p className="text-[11px] text-gray-600 italic">
                              Client wrote: "{r.clientWording}"
                            </p>
                          </>
                        )}

                        <ul className="space-y-1 pt-1">
                          {r.acceptanceCriteria.map((c, ci) => (
                            <li key={ci} className="flex gap-2.5 text-[11px] text-gray-500">
                              <span className="w-2.5 h-2.5 rounded-full border border-gray-700 flex-shrink-0 mt-0.5" />
                              <span className="leading-relaxed">{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Complexity bands help the team plan delivery sequencing. */}
                      {role !== 'client' && <Band band={r.band} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* NFRs + constraints + out of scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {doc.nonFunctionalRequirements.length > 0 && (
                <section className="space-y-2.5">
                  <SectionLabel>Must hold true throughout</SectionLabel>
                  <ul className="space-y-2">
                    {doc.nonFunctionalRequirements.map((n, i) => (
                      <li key={i} className="text-xs text-gray-400 leading-relaxed">{n}</li>
                    ))}
                  </ul>
                </section>
              )}
              {doc.constraints.length > 0 && (
                <section className="space-y-2.5">
                  <SectionLabel>Constraints</SectionLabel>
                  <ul className="space-y-2">
                    {doc.constraints.map((c, i) => (
                      <li key={i} className="text-xs text-gray-400 leading-relaxed">{c}</li>
                    ))}
                  </ul>
                </section>
              )}
              {doc.outOfScope.length > 0 && (
                <section className="space-y-2.5">
                  <SectionLabel>Explicitly out of scope</SectionLabel>
                  <ul className="space-y-2">
                    {doc.outOfScope.map((o, i) => (
                      <li key={i} className="text-xs text-gray-400 leading-relaxed">{o}</li>
                    ))}
                  </ul>
                </section>
              )}
              {doc.answers.attachments.length > 0 && (
                <section className="space-y-2.5">
                  <SectionLabel>Attachments</SectionLabel>
                  <ul className="space-y-2">
                    {doc.answers.attachments.map(f => (
                      <li key={f.id} className="flex items-center gap-2 text-xs text-gray-400">
                        <Paperclip className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        <span className="font-mono truncate">{f.name}</span>
                        <span className="font-mono text-gray-600 flex-shrink-0">{f.sizeKb} KB</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Approval record */}
            {doc.approvedAt && (
              <div className="flex items-center gap-2.5 py-4 border-t border-white/[0.06] text-xs text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>
                  Specification approved by {doc.approvedBy} on{' '}
                  {new Date(doc.approvedAt).toLocaleDateString()}. Acceptance criteria above are fixed.
                </span>
              </div>
            )}

            {/* Client checkpoint: approve the exact specification in context. */}
            {doc.status === 'awaiting_client' && canApprove && (
              <section className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-5 space-y-4">
                <div className="space-y-1.5">
                  <SectionLabel>Your approval is needed</SectionLabel>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Confirm that these requirements reflect what you need. Nothing is built until you approve the specification.
                  </p>
                </div>

                {showChangeRequest && (
                  <div className="space-y-2">
                    <label htmlFor="scope-change-request" className="text-xs text-gray-400">
                      What should the team change?
                    </label>
                    <textarea
                      id="scope-change-request"
                      value={changeRequest}
                      onChange={event => setChangeRequest(event.target.value)}
                      rows={3}
                      autoFocus
                      placeholder="For example: remove the reporting dashboard from this phase."
                      className="w-full resize-none rounded-lg border border-white/[0.10] bg-surface px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleApprove}
                    className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-brand-600"
                  >
                    <Check className="h-4 w-4" />
                    Approve specification
                  </button>
                  {showChangeRequest ? (
                    <>
                      <button
                        onClick={handleRequestChanges}
                        disabled={!changeRequest.trim()}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.12] px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Send request
                      </button>
                      <button
                        onClick={() => {
                          setShowChangeRequest(false);
                          setChangeRequest('');
                        }}
                        className="px-3 py-2 text-sm text-gray-500 transition-colors hover:text-white"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowChangeRequest(true)}
                      className="px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      Request changes
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-8">
              {can('manage_documents') && doc.status === 'in_review' && (
                <button
                  onClick={() => sendDocToClient(doc.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-on-accent text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send to client for approval
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
