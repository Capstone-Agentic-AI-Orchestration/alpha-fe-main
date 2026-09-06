import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FileText, Plus, Search } from "lucide-react";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "text-slate-600 bg-slate-100 border border-slate-200" },
  submitted: { label: "Submitted", cls: "text-sky-700 bg-sky-50 border border-sky-200" },
  estimating: { label: "Estimating", cls: "text-amber-700 bg-amber-50 border border-amber-200" },
  approved: { label: "Approved", cls: "text-indigo-700 bg-indigo-50 border border-indigo-200" },
  in_dev: { label: "In Development", cls: "text-cyan-700 bg-cyan-50 border border-cyan-200" },
  delivered: { label: "Delivered", cls: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
};

const COMPLEXITY_CLS: Record<string, string> = {
  S: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  M: "text-sky-700 bg-sky-50 border border-sky-200",
  L: "text-amber-700 bg-amber-50 border border-amber-200",
  XL: "text-red-700 bg-red-50 border border-red-200",
};

export default function SpecificationsView() {
  const { requirementDocs } = useApp();
  const [search, setSearch] = useState("");

  const filtered = requirementDocs.filter((d) => !search || d.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Specifications</h1>
            <p className="text-[13px] text-slate-500 mt-1">{requirementDocs.length} requirement documents</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
            <Plus size={14} /> New Spec
          </button>
        </div>
        <div className="relative mt-4 w-64">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search specifications…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Document</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-36">Status</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-20">Size</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Estimate</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Tags</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((doc) => {
                const status = STATUS_META[doc.status];
                return (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <FileText size={14} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{doc.title}</p>
                          <p className="text-[12px] text-slate-400 mt-0.5">{doc.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${COMPLEXITY_CLS[doc.complexity]}`}>{doc.complexity}</span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-slate-700">
                      {doc.estimatedCost ? `$${doc.estimatedCost.toLocaleString()}` : <span className="text-slate-400">TBD</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {doc.tags.map((t) => (
                          <span key={t} className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[12px] text-slate-400">{doc.createdAt}</td>
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
