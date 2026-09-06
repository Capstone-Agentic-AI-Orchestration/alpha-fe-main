import { TrendingUp, DollarSign, Percent, BarChart2, Download } from "lucide-react";

const RATE_CARDS = [
  { model: "claude-opus-5", inputRate: 15.00, outputRate: 75.00, markup: 30, clientRate: 97.50 },
  { model: "claude-sonnet-5", inputRate: 3.00, outputRate: 15.00, markup: 30, clientRate: 19.50 },
  { model: "claude-haiku-4-5", inputRate: 0.25, outputRate: 1.25, markup: 40, clientRate: 1.75 },
  { model: "gpt-4o", inputRate: 2.50, outputRate: 10.00, markup: 25, clientRate: 12.50 },
  { model: "mistral-large", inputRate: 2.00, outputRate: 6.00, markup: 20, clientRate: 7.20 },
];

const PROJECTS_BILLING = [
  { name: "Alpha Platform v2.0", client: "Internal", cost: 136.00, revenue: 0, margin: 0, invoiced: false },
  { name: "Client Portal Redesign", client: "Acme Corp", cost: 42.80, revenue: 8200, margin: 99.5, invoiced: true },
  { name: "AI Runtime Integration", client: "TechCo", cost: 18.40, revenue: 2000, margin: 99.1, invoiced: false },
  { name: "Billing Module", client: "Internal", cost: 87.20, revenue: 0, margin: 0, invoiced: false },
];

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

export default function BillingView() {
  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Billing & Usage</h1>
        <p className="text-[13px] text-slate-500 mt-1">Admin view — margin, rate cards, and subscription tracking</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value="$10,200" sub="This month" icon={<DollarSign size={16} className="text-emerald-600" />} cls="bg-emerald-50" />
          <StatCard label="AI Costs" value="$284.40" sub="All providers" icon={<BarChart2 size={16} className="text-amber-600" />} cls="bg-amber-50" />
          <StatCard label="Gross Margin" value="97.2%" sub="After AI costs" icon={<Percent size={16} className="text-indigo-600" />} cls="bg-indigo-50" />
          <StatCard label="MRR" value="$8,500" sub="+12% MoM" icon={<TrendingUp size={16} className="text-sky-600" />} cls="bg-sky-50" />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Project P&amp;L</h2>
            <button className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-900 font-medium transition-colors">
              <Download size={12} /> Export CSV
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Project</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Client</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">AI Cost</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Revenue</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Margin</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PROJECTS_BILLING.map((p) => (
                <tr key={p.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-[13px] font-semibold text-slate-900">{p.name}</td>
                  <td className="px-5 py-4 text-[13px] text-slate-500">{p.client}</td>
                  <td className="px-5 py-4 text-[13px] text-red-600 font-medium">${p.cost.toFixed(2)}</td>
                  <td className="px-5 py-4 text-[13px] text-emerald-600 font-medium">{p.revenue > 0 ? `$${p.revenue.toLocaleString()}` : "—"}</td>
                  <td className="px-5 py-4 text-[13px] text-slate-700">{p.margin > 0 ? `${p.margin}%` : "—"}</td>
                  <td className="px-5 py-4">
                    {p.invoiced
                      ? <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">Sent</span>
                      : <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Rate Cards</h2>
            <button className="text-[12px] text-indigo-600 hover:text-indigo-700 font-medium transition-colors">Edit Rates</button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Model</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-32">Input ($/1M)</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-32">Output ($/1M)</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Markup</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-36">Client Rate (out)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RATE_CARDS.map((r) => (
                <tr key={r.model} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 text-[13px] font-mono font-medium text-slate-900">{r.model}</td>
                  <td className="px-5 py-4 text-[13px] text-slate-600">${r.inputRate.toFixed(2)}</td>
                  <td className="px-5 py-4 text-[13px] text-slate-600">${r.outputRate.toFixed(2)}</td>
                  <td className="px-5 py-4 text-[13px] text-amber-600 font-semibold">{r.markup}%</td>
                  <td className="px-5 py-4 text-[13px] text-emerald-700 font-bold">${r.clientRate.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
