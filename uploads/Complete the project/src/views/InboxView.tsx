import { useState } from "react";
import { useApp } from "../context/AppContext";
import { CheckCircle2, XCircle, AlertTriangle, Info, AtSign, Check, Bell } from "lucide-react";
import type { InboxNotification } from "../config/types";

const TYPE_META: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  approval: { icon: <CheckCircle2 size={14} />, cls: "text-indigo-600 bg-indigo-50 border border-indigo-100", label: "Approval" },
  alert: { icon: <AlertTriangle size={14} />, cls: "text-amber-600 bg-amber-50 border border-amber-100", label: "Alert" },
  success: { icon: <Check size={14} />, cls: "text-emerald-600 bg-emerald-50 border border-emerald-100", label: "Success" },
  info: { icon: <Info size={14} />, cls: "text-sky-600 bg-sky-50 border border-sky-100", label: "Info" },
  mention: { icon: <AtSign size={14} />, cls: "text-purple-600 bg-purple-50 border border-purple-100", label: "Mention" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TABS = ["All", "Approvals", "Alerts", "Mentions"] as const;
type Tab = (typeof TABS)[number];

function NotifRow({ n }: { n: InboxNotification }) {
  const { approveNotification, declineNotification, markNotificationRead } = useApp();
  const meta = TYPE_META[n.type] ?? TYPE_META.info;

  return (
    <div className={`flex items-start gap-4 px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${n.read ? "opacity-60" : ""}`}>
      <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center mt-0.5 ${meta.cls}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[13px] font-semibold ${n.read ? "text-slate-500" : "text-slate-900"}`}>
            {n.title}
            {!n.read && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-indigo-500 align-middle" />}
          </p>
          <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(n.createdAt)}</span>
        </div>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{n.description}</p>
        {n.actionRequired && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => approveNotification(n.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              <CheckCircle2 size={12} /> Approve
            </button>
            <button
              onClick={() => declineNotification(n.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors border border-slate-200 font-medium"
            >
              <XCircle size={12} /> Decline
            </button>
          </div>
        )}
      </div>
      {!n.read && (
        <button onClick={() => markNotificationRead(n.id)} className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition-colors mt-1" title="Mark as read">
          <Check size={14} />
        </button>
      )}
    </div>
  );
}

export default function InboxView() {
  const { notifications } = useApp();
  const [tab, setTab] = useState<Tab>("All");

  const unread = notifications.filter((n) => !n.read).length;
  const filtered = notifications.filter((n) => {
    if (tab === "Approvals") return n.type === "approval";
    if (tab === "Alerts") return n.type === "alert";
    if (tab === "Mentions") return n.type === "mention";
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Inbox & Approvals</h1>
          {unread > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-600 text-white rounded-full">{unread}</span>
          )}
        </div>
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => {
            const count = t === "Approvals" ? notifications.filter((n) => n.type === "approval" && n.actionRequired).length : 0;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors font-medium ${
                  tab === t ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {t}
                {count > 0 && <span className="ml-1.5 text-[11px] bg-indigo-600 text-white rounded px-1">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Bell size={32} className="mb-3 opacity-30" />
            <p className="text-[13px]">No notifications</p>
          </div>
        ) : (
          filtered.map((n) => <NotifRow key={n.id} n={n} />)
        )}
      </div>
    </div>
  );
}
