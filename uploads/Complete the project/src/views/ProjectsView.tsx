import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FolderKanban, Users, CalendarDays, TrendingUp, Plus, LayoutGrid, List } from "lucide-react";
import type { Project } from "../config/types";

const STATUS_META: Record<string, { dot: string; label: string; cls: string }> = {
  active: { dot: "bg-emerald-500", label: "Active", cls: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
  on_hold: { dot: "bg-amber-500", label: "On Hold", cls: "text-amber-700 bg-amber-50 border border-amber-200" },
  completed: { dot: "bg-slate-400", label: "Completed", cls: "text-slate-600 bg-slate-100 border border-slate-200" },
};

function ProjectCard({ project }: { project: Project }) {
  const meta = STATUS_META[project.status];
  const budgetPct = Math.round((project.spent / project.budget) * 100);
  const overBudget = budgetPct > 90;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
            <FolderKanban size={17} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {project.name}
            </h3>
            <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded font-semibold mt-0.5 ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
        </div>
        <span className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{project.progress}%</span>
      </div>

      <p className="text-[12px] text-slate-500 leading-relaxed mb-4">{project.description}</p>

      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Progress</span>
          <span className="text-[11px] text-slate-500 font-medium">{project.milestone}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[12px] text-slate-500 mb-4 pb-4 border-b border-slate-100">
        <div>
          <span className="font-bold text-slate-900">${project.spent.toLocaleString()}</span>
          <span className="mx-1 text-slate-300">/</span>
          <span>${project.budget.toLocaleString()}</span>
        </div>
        <div className={`flex items-center gap-1 ${overBudget ? "text-amber-600" : "text-emerald-600"}`}>
          <TrendingUp size={11} />
          <span className="font-medium">{budgetPct}% spent</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[12px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Users size={12} />
          <span>{project.teamSize} members</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={12} />
          <span>{project.dueDate}</span>
        </div>
        <div className="ml-auto text-slate-500 font-medium">{project.issueCount} issues</div>
      </div>
    </div>
  );
}

function ProjectRow({ project }: { project: Project }) {
  const meta = STATUS_META[project.status];
  const budgetPct = Math.round((project.spent / project.budget) * 100);
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer group">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <FolderKanban size={14} className="text-indigo-600" />
          </div>
          <span className="text-[13px] font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{project.name}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${meta.cls}`}>{meta.label}</span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${project.progress}%` }} />
          </div>
          <span className="text-[12px] text-slate-600 font-medium">{project.progress}%</span>
        </div>
      </td>
      <td className="px-5 py-4 text-[13px] text-slate-600">${project.spent.toLocaleString()} <span className="text-slate-400">/ ${project.budget.toLocaleString()}</span></td>
      <td className="px-5 py-4 text-[12px] text-slate-500">{project.dueDate}</td>
      <td className="px-5 py-4 text-[12px] text-slate-500">{project.issueCount} issues</td>
    </tr>
  );
}

export default function ProjectsView() {
  const { projects } = useApp();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<"all" | "active" | "on_hold" | "completed">("all");
  const active = projects.filter((p) => p.status === "active").length;

  const filtered = filter === "all" ? projects : projects.filter((p) => p.status === filter);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Projects & Milestones</h1>
            <p className="text-[13px] text-slate-500 mt-1">{active} active · {projects.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button onClick={() => setView("grid")} className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-700"}`}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setView("list")} className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-700"}`}>
                <List size={14} />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 text-[13px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              <Plus size={14} /> New Project
            </button>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {["all", "active", "on_hold", "completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`px-3 py-1.5 text-[12px] rounded-lg transition-colors font-medium ${
                filter === f ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {f === "all" ? "All" : f.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {view === "grid" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.map((proj) => <ProjectCard key={proj.id} project={proj} />)}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Project</th>
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Status</th>
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-40">Progress</th>
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-40">Budget</th>
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-28">Due</th>
                  <th className="text-left px-5 py-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold w-24">Issues</th>
                </tr>
              </thead>
              <tbody>{filtered.map((proj) => <ProjectRow key={proj.id} project={proj} />)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
