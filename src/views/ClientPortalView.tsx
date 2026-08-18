import React from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../lib/estimator';
import { DocStatus, ProgressRing, SectionLabel } from '../components/common/Ledger';
import { Plus, ArrowRight, MessageSquare } from 'lucide-react';

export const ClientPortalView: React.FC = () => {
  const {
    currentUser,
    requirementDocs,
    estimateForDoc,
    projects,
    issues,
    ledgers,
    setActiveTab
  } = useApp();

  const myDocs = requirementDocs.filter(d => d.clientId === currentUser.id);
  const awaitingMe = myDocs.filter(d => d.status === 'awaiting_client');
  const inFlight = myDocs.filter(d => d.status === 'approved' && d.projectId);

  const firstName = currentUser.name.split(' ')[0];

  return (
    <div className="h-full overflow-y-auto bg-[#16171D]">
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-10">

        {/* Greeting + primary action */}
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {firstName}, here is where things stand
            </h1>
            <p className="text-sm text-gray-500">{currentUser.company}</p>
          </div>
          <button
            onClick={() => setActiveTab('intake')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New request
          </button>
        </div>

        {/* Needs your decision — the one thing that blocks progress */}
        {awaitingMe.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Waiting on you</SectionLabel>
            {awaitingMe.map(d => {
              const est = estimateForDoc(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveTab('estimates')}
                  className="w-full text-left p-5 rounded-xl bg-[#14151B] border border-brand-500/30 hover:border-brand-500/60 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-5">
                    <div className="space-y-2 min-w-0">
                      <span className="font-mono text-[11px] text-gray-500">{d.identifier}</span>
                      <p className="text-sm font-medium text-white">{d.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Your specification and price are ready. Nothing gets built until you approve it.
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {est && (
                        <>
                          <p className="font-mono text-lg text-white tabular-nums">
                            {formatMoney(est.buildTotal, { cents: false })}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                            one-time
                          </p>
                          {est.monthlyTotal > 0 && (
                            <p className="font-mono text-[11px] text-gray-500 tabular-nums">
                              + {formatMoney(est.monthlyTotal, { cents: false })}/mo
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-brand-400 mt-4 group-hover:gap-2.5 transition-all">
                    Review scope and price
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              );
            })}
          </section>
        )}

        {/* Work in progress */}
        {inFlight.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Being built</SectionLabel>
            <div className="divide-y divide-white/[0.03]">
              {inFlight.map(d => {
                const project = projects.find(p => p.id === d.projectId);
                const projectIssues = issues.filter(i => i.projectId === d.projectId);
                const done = projectIssues.filter(i => i.status === 'done').length;
                const ledger = ledgers.find(l => l.projectId === d.projectId);

                const overBaseline = ledger ? ledger.projectedFinal > ledger.baseline * 1.05 : false;
                const burnPct = ledger && ledger.baseline > 0 ? ledger.actualToDate / ledger.baseline : 0;

                return (
                  <div key={d.id} className="py-4 flex items-center gap-5">
                    <ProgressRing
                      value={done}
                      total={projectIssues.length || 1}
                      tone="brand"
                      size={30}
                    />
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm text-gray-200 truncate">{project?.name || d.title}</p>
                      <p className="font-mono text-[11px] text-gray-500 tabular-nums">
                        {done} of {projectIssues.length} items complete
                      </p>
                    </div>

                    {ledger && (
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="font-mono text-xs text-gray-200 tabular-nums">
                          {formatMoney(ledger.actualToDate, { cents: false })}
                          <span className="text-gray-600"> / {formatMoney(ledger.baseline, { cents: false })}</span>
                        </p>
                        <p
                          className={`flex items-center justify-end gap-1.5 text-[11px] ${
                            overBaseline ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              overBaseline ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                          />
                          {overBaseline
                            ? `tracking ${formatMoney(ledger.projectedFinal - ledger.baseline, { cents: false })} over`
                            : `${Math.round(burnPct * 100)}% of budget used`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Everything else */}
        <section className="space-y-3">
          <SectionLabel>All requests</SectionLabel>
          {myDocs.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-sm text-gray-500">You have not sent us anything yet.</p>
              <button
                onClick={() => setActiveTab('intake')}
                className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
              >
                Describe what you need
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {myDocs.map(d => {
                const est = estimateForDoc(d.id);
                return (
                  <button
                    key={d.id}
                    onClick={() => setActiveTab('documents')}
                    className="w-full flex items-center gap-5 py-3 text-left hover:bg-white/[0.02] transition-colors px-2 -mx-2 rounded"
                  >
                    <span className="font-mono text-[11px] text-gray-600 w-20 flex-shrink-0">
                      {d.identifier}
                    </span>
                    <span className="flex-1 text-xs text-gray-300 truncate">{d.title}</span>
                    <DocStatus status={d.status} />
                    <span className="font-mono text-xs text-gray-400 tabular-nums w-20 text-right flex-shrink-0">
                      {est ? formatMoney(est.buildTotal, { cents: false }) : '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Talk to the team */}
        <div className="pt-2">
          <button
            onClick={() => setActiveTab('chat')}
            className="flex items-center gap-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Message your project manager
          </button>
        </div>
      </div>
    </div>
  );
};
