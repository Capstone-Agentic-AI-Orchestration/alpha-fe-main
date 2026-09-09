import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { formatMoney } from '@/features/delivery/estimator';
import { DocStatus, Band, SectionLabel } from '@/features/delivery/Ledger';
import { FileText, Send, ArrowUpRight, Paperclip } from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const { requirementDocs, estimateForDoc, sendDocToClient, can, setActiveTab, role, projects } = useApp();

  const [selectedId, setSelectedId] = useState<string | null>(requirementDocs[0]?.id ?? null);
  const doc = requirementDocs.find(d => d.id === selectedId);
  const estimate = doc ? estimateForDoc(doc.id) : undefined;
  const project = doc?.projectId ? projects.find(p => p.id === doc.projectId) : undefined;

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
          <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">

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
                {estimate && (
                  <button
                    onClick={() => setActiveTab('billing')}
                    className="flex items-center gap-1.5 font-mono text-sm text-white tabular-nums hover:text-brand-300 transition-colors flex-shrink-0"
                  >
                    {formatMoney(estimate.buildTotal, { cents: false })}
                    <ArrowUpRight className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                )}
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

                      {/* Complexity bands are a pricing and planning device. */}
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
                  Scope and budget approved by {doc.approvedBy} on{' '}
                  {new Date(doc.approvedAt).toLocaleDateString()}. Acceptance criteria above are fixed.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pb-8">
              {can('author_estimate') && doc.status === 'in_review' && (
                <button
                  onClick={() => sendDocToClient(doc.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-on-accent text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send to client for approval
                </button>
              )}
              {estimate && doc.status === 'awaiting_client' && role === 'client' && (
                <button
                  onClick={() => setActiveTab('billing')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-on-accent text-sm font-medium transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Review the price
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
