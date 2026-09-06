import { useApp } from "../context/AppContext";
import { Cpu, RefreshCw, Plus } from "lucide-react";
import type { Runtime } from "../config/types";

const PROVIDER_META: Record<string, { color: string; abbr: string; bg: string }> = {
  anthropic: { color: "text-orange-700", abbr: "AN", bg: "bg-orange-50 border border-orange-200" },
  openai: { color: "text-emerald-700", abbr: "OA", bg: "bg-emerald-50 border border-emerald-200" },
  ollama: { color: "text-sky-700", abbr: "OL", bg: "bg-sky-50 border border-sky-200" },
  lm_studio: { color: "text-purple-700", abbr: "LM", bg: "bg-purple-50 border border-purple-200" },
  custom: { color: "text-slate-700", abbr: "CU", bg: "bg-slate-100 border border-slate-200" },
};

function RuntimeCard({ runtime }: { runtime: Runtime }) {
  const meta = PROVIDER_META[runtime.provider] ?? PROVIDER_META.custom;
  const isConnected = runtime.status === "connected";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold ${meta.bg} ${meta.color}`}>
            {meta.abbr}
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{runtime.name}</h3>
            {runtime.endpoint && <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{runtime.endpoint}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`text-[12px] font-semibold ${isConnected ? "text-emerald-700" : "text-slate-500"}`}>
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {isConnected ? (
        <>
          <div className="mb-4">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Available Models</p>
            <div className="flex flex-wrap gap-1.5">
              {runtime.models.map((m) => (
                <span key={m} className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded font-mono">{m}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 pt-3 border-t border-slate-100 text-[12px] text-slate-500">
            <div>
              <span className="font-bold text-slate-900">{runtime.requestsToday.toLocaleString()}</span>
              <span className="ml-1">req today</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">{runtime.avgLatency}ms</span>
              <span className="ml-1">avg latency</span>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {runtime.endpoint && (
            <div>
              <p className="text-[12px] text-slate-500">Ensure the service is running at:</p>
              <code className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded block mt-1">{runtime.endpoint}</code>
            </div>
          )}
          <button className="flex items-center gap-2 px-3 py-2 text-[12px] bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors font-medium">
            <RefreshCw size={12} /> Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}

export default function RuntimesView() {
  const { runtimes } = useApp();
  const connected = runtimes.filter((r) => r.status === "connected").length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>AI Runtimes</h1>
          <p className="text-[13px] text-slate-500 mt-1">{connected}/{runtimes.length} providers connected</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg transition-colors font-medium">
          <Plus size={14} /> Add Provider
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {runtimes.map((rt) => <RuntimeCard key={rt.id} runtime={rt} />)}
        </div>
      </div>
    </div>
  );
}
