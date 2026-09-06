import { useApp } from "../context/AppContext";
import { Users, Play, Link, GitBranch, Vote, Layers, Plus } from "lucide-react";
import type { SquadTopology } from "../config/types";

const TOPOLOGY_META: Record<SquadTopology, { label: string; icon: React.ReactNode; cls: string; desc: string }> = {
  chain: { label: "Chain", icon: <Link size={12} />, cls: "text-sky-700 bg-sky-50 border border-sky-200", desc: "Sequential — each agent hands off to the next" },
  parallel: { label: "Parallel", icon: <GitBranch size={12} />, cls: "text-emerald-700 bg-emerald-50 border border-emerald-200", desc: "All agents run simultaneously; results merged" },
  voting: { label: "Voting", icon: <Vote size={12} />, cls: "text-amber-700 bg-amber-50 border border-amber-200", desc: "All agents vote; majority decision wins" },
  hierarchy: { label: "Hierarchy", icon: <Layers size={12} />, cls: "text-indigo-700 bg-indigo-50 border border-indigo-200", desc: "Lead agent delegates sub-tasks to workers" },
};

export default function SquadsView() {
  const { squads, agents } = useApp();

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Agent Squads</h1>
          <p className="text-[13px] text-slate-500 mt-1">{squads.length} squads configured</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
          <Plus size={14} /> New Squad
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {squads.map((squad) => {
            const meta = TOPOLOGY_META[squad.topology];
            const squadAgents = agents.filter((a) => squad.agentIds.includes(a.id));
            return (
              <div key={squad.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Users size={16} className="text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{squad.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 mt-1 text-[11px] px-2 py-0.5 rounded font-semibold ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </div>
                  </div>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 rounded-lg transition-colors border border-slate-200 font-medium">
                    <Play size={11} /> Run
                  </button>
                </div>

                <p className="text-[12px] text-slate-500 mb-4">{squad.description}</p>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Agents ({squadAgents.length})</p>
                <div className="flex items-center gap-3 mb-4">
                  {squadAgents.map((a, i) => {
                    const dotCls = a.status === "working" ? "ring-2 ring-cyan-400" : a.status === "idle" ? "ring-2 ring-emerald-400" : "ring-2 ring-slate-200";
                    return (
                      <div key={a.id} className="flex items-center gap-2">
                        {i > 0 && <div className="w-5 h-px bg-slate-200" />}
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center ${dotCls}`}>
                            <span className="text-[10px] text-indigo-700 font-bold">{a.name.slice(0, 2)}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium">{a.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center gap-4 text-[12px] text-slate-500">
                  <span className="font-medium">{squad.runsCount} runs</span>
                  <span className="text-emerald-600 font-semibold">{squad.successRate}% success</span>
                  {squad.lastRun && (
                    <span className="ml-auto text-slate-400">
                      Last {new Date(squad.lastRun).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
