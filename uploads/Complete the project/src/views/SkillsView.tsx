import { useApp } from "../context/AppContext";
import { Terminal, GitBranch, FolderOpen, Globe, Plug, AlertTriangle } from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  execution: { label: "Execution", icon: <Terminal size={13} />, cls: "text-red-700 bg-red-50 border border-red-200" },
  vcs: { label: "Version Control", icon: <GitBranch size={13} />, cls: "text-sky-700 bg-sky-50 border border-sky-200" },
  filesystem: { label: "File System", icon: <FolderOpen size={13} />, cls: "text-amber-700 bg-amber-50 border border-amber-200" },
  web: { label: "Web", icon: <Globe size={13} />, cls: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
  mcp: { label: "MCP Server", icon: <Plug size={13} />, cls: "text-purple-700 bg-purple-50 border border-purple-200" },
};

const RISK_CLS: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

export default function SkillsView() {
  const { skills, toggleSkill } = useApp();
  const enabled = skills.filter((s) => s.enabled).length;

  const grouped = Object.entries(CATEGORY_META).map(([cat, meta]) => ({
    cat, meta, skills: skills.filter((s) => s.category === cat),
  }));

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Skills & MCP</h1>
        <p className="text-[13px] text-slate-500 mt-1">{enabled}/{skills.length} skills enabled</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700 font-medium">
            High-risk skills (bash execution, Postgres) grant agents significant system access. Enable only what is needed for your current work.
          </p>
        </div>

        {grouped.map(({ cat, meta, skills: catSkills }) => catSkills.length === 0 ? null : (
          <div key={cat} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3 bg-slate-50 border-b border-slate-200">
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded font-semibold ${meta.cls}`}>
                {meta.icon} {meta.label}
              </span>
              <span className="text-[11px] text-slate-400 ml-auto">{catSkills.filter((s) => s.enabled).length}/{catSkills.length} enabled</span>
            </div>
            {catSkills.map((skill) => (
              <div key={skill.id} className="flex items-center justify-between px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{skill.name}</p>
                      <span className={`text-[10px] font-bold uppercase ${RISK_CLS[skill.riskLevel]}`}>{skill.riskLevel} risk</span>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-0.5">{skill.description}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{skill.usageCount.toLocaleString()} executions</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill(skill.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${skill.enabled ? "bg-indigo-600" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${skill.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
