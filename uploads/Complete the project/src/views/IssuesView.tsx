import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Plus } from "lucide-react";
import type { Issue, IssueStatus } from "../config/types";

const COLS: { id: IssueStatus; label: string; dot: string; border: string; count: string }[] = [
  { id: "todo", label: "Todo", dot: "bg-slate-400", border: "border-slate-300", count: "bg-slate-100 text-slate-600" },
  { id: "in_progress", label: "In Progress", dot: "bg-cyan-500", border: "border-cyan-300", count: "bg-cyan-50 text-cyan-700" },
  { id: "review", label: "Review", dot: "bg-amber-500", border: "border-amber-300", count: "bg-amber-50 text-amber-700" },
  { id: "done", label: "Done", dot: "bg-emerald-500", border: "border-emerald-300", count: "bg-emerald-50 text-emerald-700" },
];

const PRIORITY_PILL: Record<string, string> = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-sky-50 text-sky-700 border border-sky-200",
  high: "bg-amber-50 text-amber-700 border border-amber-200",
  critical: "bg-red-50 text-red-700 border border-red-200",
};

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[11px] text-indigo-600 font-mono font-medium">{issue.id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${PRIORITY_PILL[issue.priority]}`}>
          {issue.priority}
        </span>
      </div>
      <p className="text-[12px] font-semibold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors">
        {issue.title}
      </p>
      <div className="flex gap-1 mt-2 flex-wrap">
        {issue.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{tag}</span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <span className="text-[11px] text-slate-400 truncate max-w-[100px]">
          {issue.projectName.split(" ").slice(0, 2).join(" ")}
        </span>
        {issue.assignee ? (
          <div className="w-5 h-5 rounded-md flex items-center justify-center bg-slate-200 text-[9px] text-slate-700 font-bold">
            {issue.assignee.split(" ").map((w) => w[0]).join("")}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-md border-2 border-dashed border-slate-200" />
        )}
      </div>
    </div>
  );
}

export default function IssuesView() {
  const { issues } = useApp();
  const [projectFilter, setProjectFilter] = useState("all");

  const projects = [...new Set(issues.map((i) => i.projectName))];

  const filteredIssues = projectFilter === "all" ? issues : issues.filter((i) => i.projectName === projectFilter);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Issues & Tasks</h1>
            <p className="text-[13px] text-slate-500 mt-1">{issues.length} issues across all projects</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-[13px] text-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              <Plus size={14} /> New Issue
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-x-auto p-6">
        {COLS.map((col) => {
          const colIssues = filteredIssues.filter((i) => i.status === col.id);
          return (
            <div key={col.id} className="flex flex-col w-60 flex-shrink-0">
              <div className={`flex items-center gap-2 pb-3 mb-3 border-b-2 ${col.border}`}>
                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-[13px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{col.label}</span>
                <span className={`ml-auto text-[11px] font-semibold rounded px-1.5 py-0.5 ${col.count}`}>{colIssues.length}</span>
              </div>
              <div className="flex flex-col gap-2.5 flex-1">
                {colIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                <button className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-colors border border-dashed border-slate-300 mt-1 font-medium">
                  <Plus size={12} /> Add issue
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
