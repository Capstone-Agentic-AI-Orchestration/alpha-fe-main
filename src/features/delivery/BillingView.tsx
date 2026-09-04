import React from 'react';
import { useApp } from '@/app/AppContext';
import { formatMoney, blendedTokenRate } from '@/features/delivery/estimator';
import { SectionLabel } from '@/features/delivery/Ledger';

/**
 * Admin-only. Committed client value, and what the agents are consuming.
 *
 * Per-project cost tracking used to live here — a baseline/actual/projected
 * table fed by a BudgetLedger. Only half of it was ever built: a ledger was
 * opened when a client approved an estimate and then never written to again,
 * so `actualToDate` stayed at 0 and `projectedFinal` stayed equal to the
 * baseline for the life of every project. The drift the table existed to show
 * could not occur, and the margin tile it fed read exactly $0 forever.
 *
 * Removed rather than wired up: Alpha is not tracking spend per project.
 * Committed value still comes from approved estimates, and agent compute is
 * measured for real from the token counts each run reports.
 */
export const BillingView: React.FC = () => {
  const { requirementDocs, estimates, analytics, agents, users } = useApp();

  const tokenRate = blendedTokenRate(analytics);
  const clients = users.filter(u => u.role === 'client');

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
            Committed client value, and what the agents are consuming.
          </p>
        </div>

        {/* Headline figures */}
        <div className="grid grid-cols-2 gap-8 max-w-lg">
          {[
            { label: 'Approved value', value: formatMoney(approvedValue, { cents: false }), note: 'signed off by clients' },
            { label: 'In pipeline', value: formatMoney(pipelineValue, { cents: false }), note: 'awaiting client approval' }
          ].map(stat => (
            <div key={stat.label} className="space-y-1.5">
              <SectionLabel>{stat.label}</SectionLabel>
              <p className="font-mono text-xl tabular-nums tracking-tight text-white">
                {stat.value}
              </p>
              <p className="text-[11px] text-gray-600">{stat.note}</p>
            </div>
          ))}
        </div>

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
