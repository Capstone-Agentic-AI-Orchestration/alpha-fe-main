import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Zap, DollarSign, Activity, TrendingUp } from "lucide-react";

function StatCard({ label, value, sub, icon, cls }: { label: string; value: string; sub: string; icon: React.ReactNode; cls: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${cls}`}>{icon}</div>
      <div className="text-[24px] font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{value}</div>
      <div className="text-[13px] text-slate-600 mt-0.5">{label}</div>
      <div className="text-[12px] text-slate-400 mt-0.5">{sub}</div>
    </div>
  );
}

export default function AnalyticsView() {
  const { analytics } = useApp();
  const [period, setPeriod] = useState("7d");
  const maxTokens = Math.max(...analytics.runsByDay.map((d) => d.tokens));
  const maxModelTokens = Math.max(...analytics.modelBreakdown.map((m) => m.tokens));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Analytics</h1>
          <p className="text-[13px] text-slate-500 mt-1">Token consumption and cost metrics</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {["7d", "30d", "90d"].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-[12px] rounded-md font-medium transition-colors ${period === p ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tokens" value={`${(analytics.totalTokens / 1e6).toFixed(1)}M`} sub="Last 7 days" icon={<Zap size={16} className="text-amber-600" />} cls="bg-amber-50" />
          <StatCard label="Total Cost" value={`$${analytics.totalCost.toFixed(2)}`} sub="USD this period" icon={<DollarSign size={16} className="text-emerald-600" />} cls="bg-emerald-50" />
          <StatCard label="Total Runs" value={analytics.totalRuns.toLocaleString()} sub="Agent executions" icon={<Activity size={16} className="text-cyan-600" />} cls="bg-cyan-50" />
          <StatCard label="Avg / Run" value={analytics.avgTokensPerRun.toLocaleString()} sub="Tokens per execution" icon={<TrendingUp size={16} className="text-indigo-600" />} cls="bg-indigo-50" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-[14px] font-bold text-slate-900 mb-5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Daily Token Usage</h2>
          <div className="flex items-end gap-3" style={{ height: "160px" }}>
            {analytics.runsByDay.map((d) => {
              const hPct = Math.round((d.tokens / maxTokens) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="relative w-full flex flex-col justify-end" style={{ height: "130px" }}>
                    <div
                      className="w-full bg-indigo-100 group-hover:bg-indigo-400 rounded-lg transition-colors cursor-default"
                      style={{ height: `${hPct}%` }}
                    />
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white bg-slate-900 px-2 py-1 rounded whitespace-nowrap">
                      {(d.tokens / 1e6).toFixed(1)}M · ${d.cost}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{d.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Model Breakdown</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Model</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Share</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Tokens</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Cost</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Runs</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.modelBreakdown.map((m) => {
                const pct = Math.round((m.tokens / maxModelTokens) * 100);
                return (
                  <tr key={m.model} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 text-[13px] font-mono font-medium text-slate-900">{m.model}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[12px] text-slate-500 font-medium">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-slate-700">{(m.tokens / 1e6).toFixed(1)}M</td>
                    <td className="px-5 py-4 text-[13px] text-slate-700">${m.cost.toFixed(2)}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-700">{m.runs.toLocaleString()}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-700">{m.avgLatency}ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
