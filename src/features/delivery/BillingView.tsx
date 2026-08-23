import React from 'react';
import { useApp } from '@/app/AppContext';
import { formatMoney, blendedTokenRate } from '@/features/delivery/estimator';
import { ProgressRing, SectionLabel } from '@/features/delivery/Ledger';

/**
 * Admin-only. The one surface that shows estimate-versus-actual margin —
 * what the client was quoted against what delivery is actually consuming.
 */
export const BillingView: React.FC = () => {
  const { ledgers, projects, requirementDocs, estimates, analytics, agents, users } = useApp();

  const tokenRate = blendedTokenRate(analytics);
  const clients = users.filter(u => u.role === 'client');

  const totalBaseline = ledgers.reduce((s, l) => s + l.baseline, 0);
  const totalActual = ledgers.reduce((s, l) => s + l.actualToDate, 0);
  const totalProjected = ledgers.reduce((s, l) => s + l.projectedFinal, 0);
  const margin = totalBaseline - totalProjected;

  const approvedValue = estimates
    .filter(e => e.status === 'approved')
    .reduce((s, e) => s + e.buildTotal, 0);

  const pipelineValue = estimates
    .filter(e => e.status === 'awaiting_client')
    .reduce((s, e) => s + e.buildTotal, 0);

  return (
    <div className="h-full overflow-y-auto bg-[#16171D]">
      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">

        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-white tracking-tight">Billing and usage</h1>
          <p className="text-sm text-gray-500">
            Committed value, delivery cost, and the margin between them.
          </p>
        </div>

        {/* Headline figures */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Approved value', value: formatMoney(approvedValue, { cents: false }), note: 'signed off by clients' },
            { label: 'In pipeline', value: formatMoney(pipelineValue, { cents: false }), note: 'awaiting client approval' },
            { label: 'Delivery cost to date', value: formatMoney(totalActual, { cents: false }), note: 'hours and compute accrued' },
            {
              label: 'Projected margin',
              value: formatMoney(Math.abs(margin), { cents: false }),
              note: margin >= 0 ? 'under baseline' : 'over baseline',
              tone: margin >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }
          ].map(stat => (
            <div key={stat.label} className="space-y-1.5">
              <SectionLabel>{stat.label}</SectionLabel>
              <p className={`font-mono text-xl tabular-nums tracking-tight ${stat.tone || 'text-white'}`}>
                {stat.value}
              </p>
              <p className="text-[11px] text-gray-600">{stat.note}</p>
            </div>
          ))}
        </div>

        {/* Per-project margin */}
        <section className="space-y-3">
          <SectionLabel>Estimate versus actual, by project</SectionLabel>
          {ledgers.length === 0 ? (
            <p className="py-8 text-xs text-gray-500">No approved projects yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                  <th className="text-left font-normal pb-2">Project</th>
                  <th className="text-left font-normal pb-2 hidden sm:table-cell">Client</th>
                  <th className="text-right font-normal pb-2">Baseline</th>
                  <th className="text-right font-normal pb-2">Actual</th>
                  <th className="text-right font-normal pb-2">Projected</th>
                  <th className="text-right font-normal pb-2 w-24">Burn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {ledgers.map(l => {
                  const project = projects.find(p => p.id === l.projectId);
                  const doc = requirementDocs.find(d => d.projectId === l.projectId);
                  const over = l.projectedFinal > l.baseline * 1.05;
                  const pct = l.baseline > 0 ? l.actualToDate / l.baseline : 0;

                  return (
                    <tr key={l.projectId}>
                      <td className="py-3 text-xs text-gray-200 pr-4">{project?.name || '—'}</td>
                      <td className="py-3 text-xs text-gray-500 pr-4 hidden sm:table-cell">
                        {doc?.company || doc?.clientName || '—'}
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-gray-300 tabular-nums">
                        {formatMoney(l.baseline, { cents: false })}
                      </td>
                      <td className="py-3 text-right font-mono text-xs text-gray-300 tabular-nums">
                        {formatMoney(l.actualToDate, { cents: false })}
                      </td>
                      <td
                        className={`py-3 text-right font-mono text-xs tabular-nums ${
                          over ? 'text-amber-300' : 'text-emerald-300'
                        }`}
                      >
                        {formatMoney(l.projectedFinal, { cents: false })}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                            {Math.round(pct * 100)}%
                          </span>
                          <ProgressRing
                            value={l.actualToDate}
                            total={l.baseline}
                            size={22}
                            tone={over ? 'amber' : 'emerald'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Compute cost — the honest small number */}
        <section className="space-y-3">
          <SectionLabel>Agent compute</SectionLabel>
          <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">
            Blended rate across the current model mix is{' '}
            <span className="font-mono text-gray-300">${tokenRate.toFixed(2)}</span> per million tokens.
            Compute is a real cost but a small share of delivery — oversight hours dominate, which is
            why estimates lead with them.
          </p>
          <table className="w-full">
            <thead>
              <tr className="text-[11px] font-mono uppercase tracking-wider text-gray-500">
                <th className="text-left font-normal pb-2">Agent</th>
                <th className="text-left font-normal pb-2 hidden sm:table-cell">Model</th>
                <th className="text-right font-normal pb-2">Runs</th>
                <th className="text-right font-normal pb-2">Tokens</th>
                <th className="text-right font-normal pb-2">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {agents
                .filter(a => !a.isArchived)
                .sort((a, b) => (b.stats?.tokensUsed || 0) - (a.stats?.tokensUsed || 0))
                .map(a => (
                  <tr key={a.id}>
                    <td className="py-2.5 text-xs text-gray-200 pr-4">
                      {a.name}
                      <span className="font-mono text-[11px] text-gray-600 ml-2">· {a.role}</span>
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-gray-500 pr-4 hidden sm:table-cell">
                      {a.modelName}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-gray-400 tabular-nums">
                      {(a.stats?.totalRuns || 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-gray-400 tabular-nums">
                      {((a.stats?.tokensUsed || 0) / 1_000_000).toFixed(2)}M
                    </td>
                    <td className="py-2.5 text-right font-mono text-xs text-gray-300 tabular-nums">
                      {formatMoney(((a.stats?.tokensUsed || 0) / 1_000_000) * tokenRate)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>

        {/* Clients */}
        <section className="space-y-3 pb-8">
          <SectionLabel>Client accounts</SectionLabel>
          <div className="divide-y divide-white/[0.03]">
            {clients.map(c => {
              const docs = requirementDocs.filter(d => d.clientId === c.id);
              const value = docs.reduce((sum, d) => {
                const e = estimates.find(x => x.docId === d.id && x.status === 'approved');
                return sum + (e?.buildTotal ?? 0);
              }, 0);
              return (
                <div key={c.id} className="py-3 flex items-center gap-5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-200">{c.company || c.name}</p>
                    <p className="font-mono text-[11px] text-gray-600 truncate">{c.email}</p>
                  </div>
                  <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                    {docs.length} request{docs.length === 1 ? '' : 's'}
                  </span>
                  <span className="font-mono text-xs text-gray-300 tabular-nums w-24 text-right">
                    {formatMoney(value, { cents: false })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
