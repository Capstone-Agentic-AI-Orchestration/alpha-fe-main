import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Bot, Plus, MoreHorizontal, Zap, X, Save, ChevronDown } from "lucide-react";
import type { Agent } from "../config/types";

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  idle: { label: "Idle", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border border-emerald-200" },
  working: { label: "Working", dot: "bg-cyan-500 animate-pulse-dot", text: "text-cyan-700", bg: "bg-cyan-50 border border-cyan-200" },
  offline: { label: "Offline", dot: "bg-slate-300", text: "text-slate-500", bg: "bg-slate-100 border border-slate-200" },
  error: { label: "Error", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border border-red-200" },
};

const PROVIDER_CLS: Record<string, string> = {
  Anthropic: "bg-orange-50 text-orange-700 border border-orange-200",
  OpenAI: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Custom: "bg-slate-100 text-slate-600 border border-slate-200",
};

function AgentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
          <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Create Agent</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Agent Name *</label>
            <input type="text" placeholder="e.g. SecurityBot" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Model *</label>
            <div className="relative">
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                <option>claude-sonnet-5</option>
                <option>claude-opus-5</option>
                <option>claude-haiku-4-5</option>
                <option>gpt-4o</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Description</label>
            <input type="text" placeholder="One-line description of this agent's role" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">System Prompt</label>
            <textarea rows={4} placeholder="You are a..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-medium">Cancel</button>
          <button className="flex items-center gap-2 px-4 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
            <Save size={13} /> Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent, canEdit }: { agent: Agent; canEdit: boolean }) {
  const meta = STATUS_META[agent.status];
  const provCls = PROVIDER_CLS[agent.runtime] ?? PROVIDER_CLS.Custom;

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Bot size={15} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{agent.name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] truncate">{agent.description}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-[12px] font-mono text-slate-600">{agent.model}</span>
        <span className={`inline-flex items-center ml-2 text-[10px] px-1.5 py-0.5 rounded font-semibold ${provCls}`}>
          {agent.runtime}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
          <span className={`text-[12px] font-semibold px-2 py-0.5 rounded ${meta.bg} ${meta.text}`}>{meta.label}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <Zap size={11} className="text-amber-500" />
          <span className="text-[12px] text-slate-600 font-medium">{agent.tokensPerRun.toLocaleString()}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{(agent.totalTokens / 1e6).toFixed(1)}M total</p>
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {agent.skills.slice(0, 3).map((s) => (
            <span key={s} className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{s}</span>
          ))}
          {agent.skills.length > 3 && <span className="text-[10px] text-slate-400">+{agent.skills.length - 3}</span>}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-[12px] text-slate-400">
          {new Date(agent.lastActive).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </td>
      <td className="px-5 py-4">
        {canEdit && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="text-[12px] text-indigo-600 hover:text-indigo-700 font-medium transition-colors">Edit</button>
            <button className="text-slate-400 hover:text-slate-700 transition-colors"><MoreHorizontal size={14} /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AgentsView() {
  const { agents, can, role } = useApp();
  const [showModal, setShowModal] = useState(false);
  const canCreate = can("agents", "canCreate");
  const working = agents.filter((a) => a.status === "working").length;
  const idle = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {showModal && <AgentModal onClose={() => setShowModal(false)} />}
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Agent Studio</h1>
            <p className="text-[13px] text-slate-500 mt-1">{working} working · {idle} idle · {agents.filter((a) => a.status === "offline").length} offline</p>
          </div>
          {canCreate && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              <Plus size={14} /> Create Agent
            </button>
          )}
        </div>
      </div>

      {role === "dev" && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-[12px] text-amber-700 font-medium">Developer view — agents are read-only. Contact PM or Admin to create or modify agents.</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Agent</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Model</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-32">Status</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-32">Tokens/Run</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Skills</th>
                <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-40">Last Active</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>{agents.map((a) => <AgentRow key={a.id} agent={a} canEdit={canCreate} />)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
