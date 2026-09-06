import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Rocket, CheckCircle2, XCircle, Clock, Loader2, SkipForward, Play } from "lucide-react";
import type { Deployment, DeploymentStage } from "../config/types";

const STATUS_META: Record<string, { label: string; dot: string; text: string; badge: string }> = {
  running: { label: "Running", dot: "bg-cyan-500 animate-pulse-dot", text: "text-cyan-700", badge: "bg-cyan-50 border border-cyan-200 text-cyan-700" },
  success: { label: "Success", dot: "bg-emerald-500", text: "text-emerald-700", badge: "bg-emerald-50 border border-emerald-200 text-emerald-700" },
  failed: { label: "Failed", dot: "bg-red-500", text: "text-red-700", badge: "bg-red-50 border border-red-200 text-red-700" },
  queued: { label: "Queued", dot: "bg-amber-500", text: "text-amber-700", badge: "bg-amber-50 border border-amber-200 text-amber-700" },
};

const STAGE_ICON: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-slate-400" />,
  running: <Loader2 size={14} className="text-cyan-500 animate-spin" />,
  success: <CheckCircle2 size={14} className="text-emerald-600" />,
  failed: <XCircle size={14} className="text-red-600" />,
  skipped: <SkipForward size={14} className="text-slate-400" />,
};

export default function DeploymentsView() {
  const { deployments } = useApp();
  const [selectedId, setSelectedId] = useState<string>(deployments[0]?.id ?? "");
  const selected = deployments.find((d) => d.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Deployments</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            {deployments.filter((d) => d.status === "running").length} running ·{" "}
            {deployments.filter((d) => d.status === "success").length} succeeded ·{" "}
            {deployments.filter((d) => d.status === "failed").length} failed
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
          <Rocket size={14} /> Deploy
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Status</th>
                    <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Project / Branch</th>
                    <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Trigger</th>
                    <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Started</th>
                    <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-32">Stages</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((dep) => {
                    const meta = STATUS_META[dep.status];
                    return (
                      <tr
                        key={dep.id}
                        onClick={() => setSelectedId(dep.id)}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${
                          dep.id === selectedId ? "bg-indigo-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-0.5 rounded ${meta.badge}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[13px] font-semibold text-slate-900">{dep.projectName}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{dep.branch} @ {dep.commit}</p>
                        </td>
                        <td className="px-5 py-4 text-[12px] text-slate-500">{dep.trigger}</td>
                        <td className="px-5 py-4 text-[12px] text-slate-500">
                          {new Date(dep.startedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            {dep.stages.map((s) => (
                              <div key={s.id} className={`h-1.5 flex-1 rounded-full ${
                                s.status === "success" ? "bg-emerald-500" :
                                s.status === "running" ? "bg-cyan-500" :
                                s.status === "failed" ? "bg-red-500" :
                                "bg-slate-200"
                              }`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200">
              <p className="text-[13px] font-bold text-slate-900">{selected.projectName}</p>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{selected.branch} @ {selected.commit}</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Pipeline Stages</p>
              {selected.stages.map((stage) => (
                <div key={stage.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {STAGE_ICON[stage.status]}
                    <span className="text-[13px] font-semibold text-slate-900">{stage.name}</span>
                    {stage.duration && (
                      <span className="text-[11px] text-slate-400 ml-auto">{stage.duration}s</span>
                    )}
                  </div>
                  {stage.logs.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 ml-6 space-y-1">
                      {stage.logs.map((log, i) => (
                        <p key={i} className={`text-[11px] font-mono leading-relaxed ${
                          log.toLowerCase().includes("error") || log.toLowerCase().includes("fail")
                            ? "text-red-600"
                            : "text-slate-500"
                        }`}>
                          {log}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {selected.status === "failed" && (
                <div className="pt-2">
                  <button className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium justify-center">
                    <Play size={13} /> Retry Failed Stage
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
