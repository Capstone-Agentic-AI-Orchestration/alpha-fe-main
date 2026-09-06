import { useState } from "react";
import { Clock, CheckCircle2, AlertCircle, XCircle, ChevronRight, MessageSquare } from "lucide-react";

type RequestStatus = "submitted" | "in_review" | "estimated" | "building" | "done" | "cancelled";

interface MyRequest {
  id: string;
  title: string;
  summary: string;
  status: RequestStatus;
  priority: "low" | "medium" | "high" | "critical";
  submittedAt: string;
  estimatedCost?: number;
  estimatedDays?: number;
  deliveredAt?: string;
  messages: number;
}

const MOCK_REQUESTS: MyRequest[] = [
  {
    id: "REQ-001",
    title: "Mobile App Push Notifications",
    summary: "Real-time push notification system for iOS and Android clients.",
    status: "building",
    priority: "high",
    submittedAt: "2026-08-20",
    estimatedCost: 4800,
    estimatedDays: 12,
    messages: 3,
  },
  {
    id: "REQ-002",
    title: "Admin Dashboard Analytics",
    summary: "Executive dashboard with sales funnel, cohort retention, and revenue charts.",
    status: "estimated",
    priority: "medium",
    submittedAt: "2026-08-22",
    estimatedCost: 3200,
    estimatedDays: 8,
    messages: 1,
  },
  {
    id: "REQ-003",
    title: "Stripe Billing Integration",
    summary: "Subscription tiers, metered usage, and portal for self-serve plan changes.",
    status: "done",
    priority: "critical",
    submittedAt: "2026-08-01",
    estimatedCost: 6000,
    estimatedDays: 14,
    deliveredAt: "2026-08-15",
    messages: 7,
  },
  {
    id: "REQ-004",
    title: "CSV Export for All Reports",
    summary: "Downloadable CSV for any data table across the platform.",
    status: "submitted",
    priority: "low",
    submittedAt: "2026-08-26",
    messages: 0,
  },
  {
    id: "REQ-005",
    title: "Legacy API Migration",
    summary: "Migrate deprecated v1 REST endpoints to GraphQL with backwards compat shim.",
    status: "cancelled",
    priority: "medium",
    submittedAt: "2026-07-10",
    messages: 2,
  },
];

const STATUS_META: Record<RequestStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  submitted: { label: "Submitted", cls: "bg-slate-100 text-slate-600 border border-slate-200", icon: <Clock size={11} /> },
  in_review: { label: "In Review", cls: "bg-amber-50 text-amber-700 border border-amber-200", icon: <Clock size={11} /> },
  estimated: { label: "Estimated", cls: "bg-sky-50 text-sky-700 border border-sky-200", icon: <AlertCircle size={11} /> },
  building: { label: "Building", cls: "bg-indigo-50 text-indigo-700 border border-indigo-200", icon: <Clock size={11} /> },
  done: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: <CheckCircle2 size={11} /> },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-400 border border-slate-200", icon: <XCircle size={11} /> },
};

const PRIORITY_CLS: Record<string, string> = {
  low: "text-slate-500",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

const BUILD_STAGES: Record<RequestStatus, number> = {
  submitted: 0, in_review: 1, estimated: 2, building: 3, done: 4, cancelled: -1,
};

const STAGE_LABELS = ["Submitted", "In Review", "Estimated", "Building", "Delivered"];

export default function MyRequestsView() {
  const [filter, setFilter] = useState<"all" | RequestStatus>("all");
  const [selected, setSelected] = useState<MyRequest | null>(null);

  const visible = filter === "all" ? MOCK_REQUESTS : MOCK_REQUESTS.filter((r) => r.status === filter);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>My Requests</h1>
        <p className="text-[13px] text-slate-500 mt-1">Track all submitted build requests and their current status.</p>
      </div>

      <div className="bg-white px-6 py-3 border-b border-slate-100 flex items-center gap-2 overflow-x-auto">
        {(["all", "building", "estimated", "submitted", "done", "cancelled"] as const).map((f) => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap ${
              filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >{f === "all" ? `All (${MOCK_REQUESTS.length})` : STATUS_META[f]?.label ?? f}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {visible.map((req) => {
          const meta = STATUS_META[req.status];
          const isOpen = selected?.id === req.id;
          return (
            <div key={req.id}
              className={`bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                isOpen ? "border-indigo-400 ring-1 ring-indigo-100" : "border-slate-200"
              }`}
            >
              <div className="p-5 cursor-pointer" onClick={() => setSelected(isOpen ? null : req)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-400 font-mono">{req.id}</span>
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-semibold ${meta.cls}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className={`text-[11px] font-bold capitalize ${PRIORITY_CLS[req.priority]}`}>{req.priority}</span>
                    </div>
                    <h3 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{req.title}</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5">{req.summary}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    {req.estimatedCost && (
                      <div>
                        <div className="text-[14px] font-bold text-slate-900">${req.estimatedCost.toLocaleString()}</div>
                        <div className="text-[11px] text-slate-400">{req.estimatedDays}d est.</div>
                      </div>
                    )}
                    {req.messages > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <MessageSquare size={12} /> {req.messages}
                      </div>
                    )}
                    <ChevronRight size={14} className={`text-slate-300 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </div>
                </div>
              </div>

              {isOpen && req.status !== "cancelled" && (
                <div className="px-5 pb-5 pt-0 border-t border-slate-100">
                  <div className="pt-4">
                    <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-3">Progress</p>
                    <div className="flex items-center">
                      {STAGE_LABELS.map((label, i) => {
                        const current = BUILD_STAGES[req.status];
                        const done = i <= current;
                        const active = i === current;
                        return (
                          <div key={label} className="flex items-center flex-1">
                            <div className="flex flex-col items-center">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                done ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"
                              } ${active ? "ring-4 ring-indigo-100" : ""}`}>
                                {done && i < current ? "✓" : i + 1}
                              </div>
                              <span className={`text-[10px] mt-1 whitespace-nowrap ${done ? "text-indigo-600 font-semibold" : "text-slate-400"}`}>{label}</span>
                            </div>
                            {i < STAGE_LABELS.length - 1 && (
                              <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < current ? "bg-indigo-500" : "bg-slate-200"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {req.status === "estimated" && (
                    <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-sky-800">Estimate ready for approval</p>
                        <p className="text-[12px] text-sky-600">${req.estimatedCost?.toLocaleString()} · {req.estimatedDays} business days</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1.5 text-[12px] text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium">Decline</button>
                        <button className="px-3 py-1.5 text-[12px] text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium">Approve & Start</button>
                      </div>
                    </div>
                  )}

                  {req.status === "done" && req.deliveredAt && (
                    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <p className="text-[13px] font-semibold text-emerald-800">Delivered on {req.deliveredAt}</p>
                      </div>
                      <button className="text-[12px] text-indigo-600 hover:underline font-medium">View deployment →</button>
                    </div>
                  )}

                  {req.messages > 0 && (
                    <button className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 text-[12px] text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors font-medium">
                      <MessageSquare size={13} /> View {req.messages} message{req.messages !== 1 ? "s" : ""}
                    </button>
                  )}
                </div>
              )}

              {isOpen && req.status === "cancelled" && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  <p className="text-[13px] text-slate-500">This request was cancelled. <button className="text-indigo-600 hover:underline">Re-open as new request</button></p>
                </div>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-[13px]">No requests matching this filter.</div>
        )}
      </div>
    </div>
  );
}
