import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatMoney } from '../lib/estimator';
import { Figure, Range, EstStatus, Band, SectionLabel } from '../components/common/Ledger';
import { Check, X, SlidersHorizontal, Send, ShieldCheck, Info } from 'lucide-react';

export const EstimatesView: React.FC = () => {
  const {
    requirementDocs,
    estimates,
    estimateForDoc,
    toggleRequirementIncluded,
    regenerateEstimate,
    approveScopeAndBudget,
    rejectEstimate,
    sendDocToClient,
    role,
    can,
    setActiveTab
  } = useApp();

  const priced = requirementDocs.filter(d => estimates.some(e => e.docId === d.id));
  const [selectedId, setSelectedId] = useState<string | null>(priced[0]?.id ?? null);
  const [showRateCard, setShowRateCard] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const doc = requirementDocs.find(d => d.id === selectedId);
  const estimate = doc ? estimateForDoc(doc.id) : undefined;

  const buildLines = estimate?.lines.filter(l => l.costClass === 'build') ?? [];
  const recurringLines = estimate?.lines.filter(l => l.costClass !== 'build') ?? [];
  const isClient = role === 'client';
  const canAct = isClient && doc?.status === 'awaiting_client';

  const included = doc?.functionalRequirements.filter(r => r.included).length ?? 0;
  const totalReqs = doc?.functionalRequirements.length ?? 0;
  const ceiling = doc?.answers.budgetCeiling;
  const overCeiling = ceiling !== undefined && estimate ? estimate.buildTotal > ceiling : false;

  return (
    <div className="h-full flex overflow-hidden bg-[#16171D] text-sm">

      {/* Roster */}
      <div className="w-72 border-r border-white/[0.06] flex flex-col flex-shrink-0 bg-[#14151B]">
        <div className="h-14 px-5 flex items-center border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white">Estimates</h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.03]">
          {priced.length === 0 && (
            <p className="p-5 text-xs text-gray-500">No estimates yet.</p>
          )}
          {priced.map(d => {
            const est = estimateForDoc(d.id);
            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`w-full text-left px-5 py-3.5 space-y-1.5 transition-colors ${
                  selectedId === d.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-gray-500">{est?.identifier}</span>
                  <span className="font-mono text-xs text-white tabular-nums">
                    {est ? formatMoney(est.buildTotal, { cents: false }) : '—'}
                  </span>
                </div>
                <p className="text-xs text-gray-300 truncate">{d.title}</p>
                {est && <EstStatus status={est.status} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail */}
      {!doc || !estimate ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Select an estimate
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

            {/* Head */}
            <div className="flex items-start justify-between gap-6 pb-6 border-b border-white/[0.06]">
              <div className="space-y-2">
                <div className="flex items-center gap-3 font-mono text-[11px] text-gray-500">
                  <span>{estimate.identifier}</span>
                  <span>·</span>
                  <span>rev {estimate.revision}</span>
                  <span>·</span>
                  <span>{doc.identifier}</span>
                </div>
                <h1 className="text-lg font-semibold text-white tracking-tight">{doc.title}</h1>
                <EstStatus status={estimate.status} />
              </div>
              <div className="text-right space-y-1 flex-shrink-0">
                <p className="font-mono text-2xl text-white tabular-nums tracking-tight">
                  {formatMoney(estimate.buildTotal, { cents: false })}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">one-time build</p>
                <Range low={estimate.buildLow} high={estimate.buildHigh} />
              </div>
            </div>

            {/* Budget ceiling check — only when the client stated one */}
            {ceiling !== undefined && (
              <div
                className={`flex items-start gap-3 text-xs ${
                  overCeiling ? 'text-amber-300' : 'text-emerald-300'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${
                    overCeiling ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <p className="leading-relaxed">
                  {overCeiling
                    ? `This is ${formatMoney(estimate.buildTotal - ceiling, { cents: false })} above the ${formatMoney(ceiling, { cents: false })} ceiling you set. Drop items below to bring it down, or tell us and we will re-scope.`
                    : `Within the ${formatMoney(ceiling, { cents: false })} ceiling you set, with ${formatMoney(ceiling - estimate.buildTotal, { cents: false })} of headroom.`}
                </p>
              </div>
            )}

            {/* Build lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>One-time build</SectionLabel>
                {can('author_estimate') && (
                  <button
                    onClick={() => setShowRateCard(!showRateCard)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Rate card
                  </button>
                )}
              </div>

              {showRateCard && can('author_estimate') && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-white/[0.06]">
                  {([
                    ['devHourly', 'Dev / hour'],
                    ['pmHourly', 'PM / hour'],
                    ['qaHourly', 'QA / hour'],
                    ['contingency', 'Contingency']
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-[11px] text-gray-500 block">{label}</label>
                      <input
                        type="number"
                        step={key === 'contingency' ? 0.05 : 5}
                        value={estimate.rateCard[key]}
                        onChange={e =>
                          regenerateEstimate(doc.id, {
                            ...estimate.rateCard,
                            [key]: Number(e.target.value) || 0
                          })
                        }
                        className="w-full bg-[#14151B] border border-white/[0.08] rounded-lg px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                    <th className="text-left font-normal pb-2">Line</th>
                    <th className="text-left font-normal pb-2 hidden sm:table-cell">Basis</th>
                    <th className="text-right font-normal pb-2">Estimate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {buildLines.map(l => (
                    <tr key={l.id}>
                      <td className="py-2.5 text-gray-200 text-xs whitespace-nowrap pr-4">{l.label}</td>
                      <td className="py-2.5 text-gray-500 text-xs hidden sm:table-cell pr-4">{l.basis}</td>
                      <td className="py-2.5 text-right">
                        <Figure amount={l.amount} confidence={l.confidence} className="text-xs text-gray-200" />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.10]">
                    <td className="pt-3 text-xs font-semibold text-white" colSpan={2}>
                      One-time total
                    </td>
                    <td className="pt-3 text-right">
                      <span className="font-mono text-sm text-white tabular-nums">
                        {formatMoney(estimate.buildTotal, { cents: false })}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Recurring lines */}
            {recurringLines.length > 0 && (
              <div className="space-y-3">
                <SectionLabel>After launch, every month</SectionLabel>
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                      <th className="text-left font-normal pb-2">Service</th>
                      <th className="text-left font-normal pb-2 hidden sm:table-cell">Required by</th>
                      <th className="text-right font-normal pb-2">Monthly</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {recurringLines.map(l => (
                      <tr key={l.id}>
                        <td className="py-2.5 pr-4">
                          <p className="text-xs text-gray-200">{l.label}</p>
                          <p className="text-[11px] text-gray-600 mt-0.5">{l.basis}</p>
                        </td>
                        <td className="py-2.5 text-gray-500 text-xs hidden sm:table-cell pr-4 italic">
                          {l.forcedBy ? `"${l.forcedBy}"` : '—'}
                        </td>
                        <td className="py-2.5 text-right">
                          {l.displayOverride ? (
                            <span className="font-mono text-xs text-gray-200 tabular-nums">{l.displayOverride}</span>
                          ) : (
                            <Figure amount={l.amount} confidence={l.confidence} className="text-xs text-gray-200" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.10]">
                      <td className="pt-3 text-xs font-semibold text-white" colSpan={2}>
                        Monthly total, excluding transaction fees
                      </td>
                      <td className="pt-3 text-right">
                        <span className="font-mono text-sm text-white tabular-nums">
                          {formatMoney(estimate.monthlyTotal, { cents: false })}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Scope toggles — the negotiation surface */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <SectionLabel>What you are paying for</SectionLabel>
                <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                  {included} of {totalReqs} included
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Drop anything you do not need in the first version. The price updates as you do.
              </p>

              <div className="divide-y divide-white/[0.03]">
                {doc.functionalRequirements.map(r => (
                  <div
                    key={r.id}
                    className={`flex items-start gap-3.5 py-3 group transition-opacity ${
                      r.included ? '' : 'opacity-40'
                    }`}
                  >
                    <button
                      onClick={() => canAct && toggleRequirementIncluded(doc.id, r.id)}
                      disabled={!canAct}
                      className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                        r.included
                          ? 'bg-brand-500 border-brand-500'
                          : 'border-white/20 hover:border-white/40'
                      } ${canAct ? 'cursor-pointer' : 'cursor-default'}`}
                      aria-label={r.included ? `Remove ${r.clientWording}` : `Include ${r.clientWording}`}
                    >
                      {r.included && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-gray-200">{r.clientWording}</p>
                      {/* The client is deciding what to keep, not reading a
                          technical statement. The formal wording stays on the
                          specification, where it can be opened deliberately. */}
                      {!isClient && (
                        <p className="text-[11px] text-gray-600 leading-relaxed">{r.requirement}</p>
                      )}
                      <p className="text-[11px] text-gray-600">
                        {r.acceptanceCriteria.length} checks we must pass
                      </p>
                    </div>

                    {!isClient && <Band band={r.band} />}
                  </div>
                ))}
              </div>
            </div>

            {/* Provenance */}
            <div className="flex items-start gap-3 py-4 border-t border-white/[0.06] text-[11px] text-gray-500 leading-relaxed">
              <Info
                className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                  estimate.calibrated ? 'text-gray-600' : 'text-amber-400'
                }`}
              />
              <div className="space-y-1.5">
                {/* Say what the number rests on. An estimate that implies
                    evidence it does not have is worse than one that admits
                    it is extrapolating. */}
                <p>
                  {estimate.calibrated ? (
                    <>
                      Ranges are calibrated against{' '}
                      <span className="font-mono text-gray-400">{estimate.comparableSampleSize}</span>{' '}
                      comparable requirements this team has finished.
                    </>
                  ) : (
                    <span className="text-amber-300/90">
                      We have finished{' '}
                      <span className="font-mono">{estimate.comparableSampleSize}</span> comparable
                      {estimate.comparableSampleSize === 1 ? ' requirement' : ' requirements'} so far, so
                      these ranges are widened on purpose. The effort figures are our starting
                      assumptions, not measurements, and they will tighten as we close work.
                    </span>
                  )}
                </p>
                <p>
                  Agent compute is priced at{' '}
                  <span className="font-mono text-gray-400">
                    ${estimate.rateCard.tokenRatePerMillion.toFixed(2)}
                  </span>{' '}
                  per million tokens — the rate this workspace is actually paying today.
                  Approving fixes the scope listed above; changes afterwards are re-estimated
                  and need a new approval.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-3 pb-8">
              {can('author_estimate') && doc.status === 'in_review' && (
                <button
                  onClick={() => sendDocToClient(doc.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send to client
                </button>
              )}

              {canAct && (
                <>
                  <button
                    onClick={() => setRejectOpen(true)}
                    className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/[0.05] border border-white/[0.10] transition-colors"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() => {
                      approveScopeAndBudget(doc.id);
                      setActiveTab('portal');
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Approve scope and budget
                  </button>
                </>
              )}

              {doc.status === 'approved' && (
                <span className="flex items-center gap-2 text-xs text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Approved by {doc.approvedBy} on{' '}
                  {doc.approvedAt ? new Date(doc.approvedAt).toLocaleDateString() : '—'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request-changes dialog */}
      {rejectOpen && doc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="w-full max-w-md bg-[#1A1B22] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-semibold text-white">What needs to change?</h3>
              <button
                onClick={() => setRejectOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              autoFocus
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="The deposit feature is more than we need right now, and the timeline is too tight."
              className="w-full bg-[#14151B] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRejectOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  rejectEstimate(doc.id, rejectReason);
                  setRejectOpen(false);
                  setRejectReason('');
                }}
                disabled={!rejectReason.trim()}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-30 text-white text-sm font-medium transition-colors"
              >
                Send to your team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
