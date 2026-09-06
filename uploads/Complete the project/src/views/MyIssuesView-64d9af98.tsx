import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Plus, AlertCircle, Filter } from "lucide-react";

const STATUS_META: Record<string, { label: string; dot: string; rowCls: string }> = {
  todo: { label: "Todo", dot: "bg-slate-400", rowCls: "" },
  in_progress: { label: "In Progress", dot: "bg-cyan-500 animate-pulse-dot", rowCls: "" },
  review: { label: "Review", dot: "bg-amber-500", rowCls: "" },
  done: { label: "Done", dot: "bg-emerald-500", rowCls: "opacity-60" },
};

const PRIORITY_META: Record<string, { label: string; cls: string; bg: string }> = {
  low: { label: "Low", cls: "text-slate-500", bg: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", cls: "text-sky-600", bg: "bg-sky-50 text-sky-700 border border-sky-200" },
  high: { label: "High", cls: "text-amber-600", bg: "bg-amber-50 text-amber-700 border border-amber-200" },
  critical: { label: "Critical", cls: "text-red-600", bg: "bg-red-50 text-red-700 border border-red-200" },
};

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function MyIssuesView() {
  const { issues, currentUser } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const myIssues = issues.filter((i) => i.assignee === currentUser.name || !i.assignee);
  const filtered = myIssues.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inProgress = myIssues.filter((i) => i.status === "in_progress").length;
  const todo = myIssues.filter((i) => i.status === "todo").length;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>My Issues</h1>
            <p className="text-[13px] text-slate-500 mt-1">{inProgress} in progress · {todo} to do · {myIssues.length} total</p>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
            <Plus size={14} /> Create Issue
          </button>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-56"
          />
          <div className="flex items-center gap-1">
            {["all", "todo", "in_progress", "review", "done"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-[12px] rounded-lg transition-colors font-medium ${
                  filter === f ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">ID</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Title</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Status</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Priority</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-40">Project</th>
                <th className="text-left px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-20">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((issue) => {
                const status = STATUS_META[issue.status];
                const priority = PRIORITY_META[issue.priority];
                const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date(Date.now() + 3 * 86400000) && issue.status !== "done";
                return (
                  <tr key={issue.id} className={`hover:bg-slate-50 transition-colors group cursor-pointer ${status.rowCls}`}>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-indigo-600 font-mono font-medium">{issue.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                          {issue.title}
                        </span>
                        {issue.agentId && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded font-medium">agent</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {issue.tags.map((tag) => (
                          <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
                        <span className="text-[12px] text-slate-600 font-medium">{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${priority.bg}`}>{priority.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[12px] text-slate-500 truncate block max-w-[150px]">{issue.projectName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isOverdue && <AlertCircle size={11} className="text-amber-500" />}
                        <span className={`text-[12px] ${isOverdue ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                          {formatDate(issue.dueDate)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-slate-400">
                    No issues match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
