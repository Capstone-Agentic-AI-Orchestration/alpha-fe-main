import { useState, useEffect, useRef } from "react";
import { Zap, Pause, Play, X, ChevronRight, ArrowRight, RotateCcw, Clock, CheckCircle2, AlertTriangle, Package, History, FileCode2, Database, Shield, Globe, Server, Layers, FileText, GitBranch, Rocket, Eye, Hash } from "lucide-react";
import { useApp } from "../context/AppContext";

// ─── types ───────────────────────────────────────────────────────────────────

type StageId = "prompt" | "requirements" | "contract" | "architecture" | "build" | "self_review" | "validation" | "github" | "deploy";
type ModuleStatus = "idle" | "queued" | "working" | "done" | "error";

interface BuildStage {
  id: StageId;
  label: string;
  shortLabel: string;
}

interface Module {
  id: string;
  name: string;
  icon: React.ReactNode;
  agent: string;
  status: ModuleStatus;
  progress: number;
  currentActivity: string;
  logs: string[];
  inputArtifacts: string[];
  outputArtifacts: string[];
}

interface BuildArtifact {
  name: string;
  status: "generating" | "validating" | "approved" | "failed";
  size: string;
}

// ─── constants ────────────────────────────────────────────────────────────────

const STAGES: BuildStage[] = [
  { id: "prompt", label: "Prompt Analysis", shortLabel: "Prompt" },
  { id: "requirements", label: "Requirements", shortLabel: "Requirements" },
  { id: "contract", label: "API Contract", shortLabel: "Contract" },
  { id: "architecture", label: "Architecture", shortLabel: "Architecture" },
  { id: "build", label: "Build", shortLabel: "Build" },
  { id: "self_review", label: "Self Review", shortLabel: "Review" },
  { id: "validation", label: "Validation", shortLabel: "Validation" },
  { id: "github", label: "GitHub Push", shortLabel: "GitHub" },
  { id: "deploy", label: "Deploy", shortLabel: "Deploy" },
];

const INITIAL_MODULES: Module[] = [
  {
    id: "requirements",
    name: "Requirements",
    icon: <FileText size={14} />,
    agent: "SpecBot",
    status: "done",
    progress: 100,
    currentActivity: "Requirements locked",
    logs: ["Parsed 3 user stories", "Extracted 14 acceptance criteria", "Generated spec doc v1.2"],
    inputArtifacts: ["prompt.md"],
    outputArtifacts: ["requirements.md", "acceptance-criteria.json"],
  },
  {
    id: "api_contract",
    name: "API Contract",
    icon: <Globe size={14} />,
    agent: "ContractBot",
    status: "done",
    progress: 100,
    currentActivity: "OpenAPI spec generated",
    logs: ["Defined 22 endpoints", "Generated OpenAPI 3.1 schema", "Validated against requirements"],
    inputArtifacts: ["requirements.md"],
    outputArtifacts: ["openapi.yaml", "types.d.ts"],
  },
  {
    id: "architecture",
    name: "Architecture",
    icon: <Layers size={14} />,
    agent: "ArchBot",
    status: "done",
    progress: 100,
    currentActivity: "Architecture approved",
    logs: ["Designed microservice layout", "Defined data models", "Generated architecture.md"],
    inputArtifacts: ["requirements.md", "openapi.yaml"],
    outputArtifacts: ["architecture.md", "schema.prisma"],
  },
  {
    id: "frontend",
    name: "Frontend",
    icon: <Globe size={14} />,
    agent: "UIBot",
    status: "working",
    progress: 64,
    currentActivity: "Building authentication flows",
    logs: ["Scaffolded Next.js app", "Created 12 components", "Building auth screens…"],
    inputArtifacts: ["architecture.md", "openapi.yaml"],
    outputArtifacts: ["src/app/", "src/components/"],
  },
  {
    id: "backend",
    name: "Backend",
    icon: <Server size={14} />,
    agent: "CodeSage",
    status: "working",
    progress: 48,
    currentActivity: "Implementing user service",
    logs: ["Initialized Express app", "Set up Prisma ORM", "Implementing /auth endpoints…"],
    inputArtifacts: ["architecture.md", "openapi.yaml", "schema.prisma"],
    outputArtifacts: ["src/server/", "src/routes/"],
  },
  {
    id: "database",
    name: "Database",
    icon: <Database size={14} />,
    agent: "DataBot",
    status: "done",
    progress: 100,
    currentActivity: "Migrations ready",
    logs: ["Generated Prisma schema", "Created 6 migrations", "Seeded test data"],
    inputArtifacts: ["schema.prisma"],
    outputArtifacts: ["migrations/", "seed.ts"],
  },
  {
    id: "auth",
    name: "Auth & Security",
    icon: <Shield size={14} />,
    agent: "SecureBot",
    status: "queued",
    progress: 0,
    currentActivity: "Waiting for backend module",
    logs: [],
    inputArtifacts: ["openapi.yaml"],
    outputArtifacts: ["auth/", "middleware/"],
  },
  {
    id: "self_review",
    name: "Self Review",
    icon: <Eye size={14} />,
    agent: "CriticBot",
    status: "idle",
    progress: 0,
    currentActivity: "Not started",
    logs: [],
    inputArtifacts: ["src/"],
    outputArtifacts: ["review-report.md"],
  },
  {
    id: "validation",
    name: "Validation",
    icon: <CheckCircle2 size={14} />,
    agent: "QABot",
    status: "idle",
    progress: 0,
    currentActivity: "Not started",
    logs: [],
    inputArtifacts: ["src/", "review-report.md"],
    outputArtifacts: ["test-results.json"],
  },
];

const INITIAL_ARTIFACTS: BuildArtifact[] = [
  { name: "requirements.md", status: "approved", size: "4.2 KB" },
  { name: "acceptance-criteria.json", status: "approved", size: "2.1 KB" },
  { name: "openapi.yaml", status: "approved", size: "18.4 KB" },
  { name: "types.d.ts", status: "approved", size: "8.7 KB" },
  { name: "architecture.md", status: "approved", size: "6.3 KB" },
  { name: "schema.prisma", status: "approved", size: "3.8 KB" },
  { name: "migrations/", status: "approved", size: "12.1 KB" },
  { name: "src/app/layout.tsx", status: "validating", size: "2.4 KB" },
  { name: "src/app/auth/", status: "generating", size: "—" },
  { name: "src/server/index.ts", status: "validating", size: "1.2 KB" },
  { name: "src/routes/user.ts", status: "generating", size: "—" },
];

const LOG_ENTRIES = [
  "Analyzing component dependencies…",
  "Running type checker on generated code…",
  "Optimizing import paths…",
  "Generating responsive layout variants…",
  "Validating API contract alignment…",
  "Writing unit test stubs…",
  "Checking for security patterns…",
  "Resolving module conflicts…",
];

const ARTIFACT_STATUS_META: Record<BuildArtifact["status"], { cls: string; label: string }> = {
  generating: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Generating" },
  validating: { cls: "bg-sky-50 text-sky-700 border-sky-200", label: "Validating" },
  approved: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Approved" },
  failed: { cls: "bg-red-50 text-red-700 border-red-200", label: "Failed" },
};

const MODULE_STATUS_DOT: Record<ModuleStatus, string> = {
  idle: "bg-slate-300",
  queued: "bg-amber-400",
  working: "bg-cyan-500 animate-pulse",
  done: "bg-emerald-500",
  error: "bg-red-500",
};

// ─── component ────────────────────────────────────────────────────────────────

export default function LiveBuildRoomView() {
  const { role } = useApp();
  const [paused, setPaused] = useState(false);
  const [activeStage, setActiveStage] = useState<StageId>("build");
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);
  const [artifacts, setArtifacts] = useState<BuildArtifact[]>(INITIAL_ARTIFACTS);
  const [overallProgress, setOverallProgress] = useState(54);
  const [showHistory, setShowHistory] = useState(false);
  const [tick, setTick] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const canControl = role === "pm" || role === "admin" || role === "dev";
  const canApprove = role === "pm" || role === "admin";

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setModules((prev) =>
        prev.map((m) => {
          if (m.status !== "working") return m;
          const newProg = Math.min(100, m.progress + Math.random() * 3);
          const newStatus: ModuleStatus = newProg >= 100 ? "done" : "working";
          const addLog = Math.random() < 0.3;
          const newLogs = addLog
            ? [...m.logs.slice(-6), LOG_ENTRIES[Math.floor(Math.random() * LOG_ENTRIES.length)]]
            : m.logs;
          return { ...m, progress: newProg, status: newStatus, logs: newLogs };
        })
      );
      setOverallProgress((p) => Math.min(100, p + Math.random() * 0.8));
    }, 1500);
    return () => clearInterval(interval);
  }, [paused]);

  const activeModuleCount = modules.filter((m) => m.status === "working").length;
  const doneModuleCount = modules.filter((m) => m.status === "done").length;
  const approvedArtifactCount = artifacts.filter((a) => a.status === "approved").length;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse flex-shrink-0" />
          <h1 className="text-[18px] font-bold text-slate-900 truncate" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Live Build Room
          </h1>
          <span className="text-[12px] text-slate-400 font-mono flex-shrink-0">#24</span>
          <span className="text-[12px] text-slate-500 truncate hidden lg:block">Alpha Platform v2.0 — Auth + Dashboard module</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[12px] text-emerald-700 font-semibold">Healthy</span>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-lg transition-colors font-medium">
            <History size={13} /> History
          </button>
          {canControl && !paused && (
            <button onClick={() => setPaused(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg transition-colors font-medium">
              <Pause size={13} /> Pause
            </button>
          )}
          {canControl && paused && (
            <button onClick={() => setPaused(false)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
              <Play size={13} /> Resume
            </button>
          )}
          {role === "admin" && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg transition-colors font-medium">
              <X size={13} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Pipeline timeline */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {STAGES.map((stage, i) => {
            const stageIndex = STAGES.findIndex((s) => s.id === stage.id);
            const activeIndex = STAGES.findIndex((s) => s.id === activeStage);
            const isDone = stageIndex < activeIndex;
            const isActive = stage.id === activeStage;
            return (
              <div key={stage.id} className="flex items-center">
                <button
                  onClick={() => setActiveStage(stage.id)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-1 rounded-xl transition-all ${isActive ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    isDone ? "bg-indigo-600 text-white"
                    : isActive ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                    : "bg-slate-200 text-slate-500"
                  }`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? "text-indigo-700" : isDone ? "text-slate-600" : "text-slate-400"}`}>
                    {stage.shortLabel}
                  </span>
                </button>
                {i < STAGES.length - 1 && (
                  <div className={`w-6 h-0.5 mx-1 flex-shrink-0 ${stageIndex < activeIndex ? "bg-indigo-500" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Module grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {modules.map((mod) => (
              <ModuleCard key={mod.id} module={mod} canControl={canControl} tick={tick} />
            ))}
          </div>

          {/* Artifacts */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-slate-500" />
                <h3 className="text-[13px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Build Artifacts</h3>
                <span className="text-[11px] text-slate-400">{approvedArtifactCount}/{artifacts.length} approved</span>
              </div>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {artifacts.map((art) => {
                const meta = ARTIFACT_STATUS_META[art.status];
                return (
                  <div key={art.name} className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border font-medium ${meta.cls}`}>
                    <FileCode2 size={10} />
                    <span className="font-mono">{art.name}</span>
                    <span className="opacity-60">·</span>
                    <span>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 border-l border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
          {/* Overall progress */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-3">Build Status</p>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] text-slate-600 font-medium">Overall Progress</span>
                <span className="text-[13px] font-bold text-indigo-700">{Math.round(overallProgress)}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <div className="text-[18px] font-bold text-slate-900">{activeModuleCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Active</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <div className="text-[18px] font-bold text-slate-900">{doneModuleCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Done</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <div className="text-[18px] font-bold text-slate-900">{approvedArtifactCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-0.5">Artifacts</div>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <div className="text-[18px] font-bold text-slate-900">0</div>
                <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mt-0.5">Issues</div>
              </div>
            </div>
          </div>

          {/* Active handoff */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-3">Active Handoff</p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">AB</div>
                <span className="text-[12px] font-semibold text-slate-900">ArchBot</span>
                <ArrowRight size={12} className="text-slate-400" />
                <div className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-[10px] font-bold text-cyan-700">CS</div>
                <span className="text-[12px] font-semibold text-slate-900">CodeSage</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Context package transferring</p>
              <div className="space-y-1">
                {["architecture.md", "openapi.yaml", "schema.prisma", "types.d.ts"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-[11px] text-indigo-700">
                    <FileCode2 size={9} />
                    <span className="font-mono">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agent roster */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-3">Agents</p>
            <div className="space-y-2">
              {[
                { name: "CodeSage", task: "Backend impl.", status: "working" },
                { name: "UIBot", task: "Frontend auth", status: "working" },
                { name: "SpecBot", task: "Done", status: "done" },
                { name: "ArchBot", task: "Done", status: "done" },
                { name: "DataBot", task: "Done", status: "done" },
                { name: "SecureBot", task: "Queued", status: "queued" },
              ].map((a) => (
                <div key={a.name} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.status === "working" ? "bg-cyan-500 animate-pulse"
                    : a.status === "done" ? "bg-emerald-500"
                    : "bg-slate-300"
                  }`} />
                  <span className="text-[12px] font-semibold text-slate-800 w-20 flex-shrink-0">{a.name}</span>
                  <span className="text-[11px] text-slate-400 truncate">{a.task}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Approval actions for PM/admin */}
          {canApprove && (
            <div className="p-4">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-3">Actions</p>
              <div className="space-y-2">
                <button className="w-full flex items-center gap-2 justify-center px-3 py-2 text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
                  <CheckCircle2 size={12} /> Approve Stage
                </button>
                <button className="w-full flex items-center gap-2 justify-center px-3 py-2 text-[12px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                  <RotateCcw size={12} /> Retry Module
                </button>
                <button className="w-full flex items-center gap-2 justify-center px-3 py-2 text-[12px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-medium transition-colors">
                  <GitBranch size={12} /> View Diff
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Build History Drawer */}
      {showHistory && (
        <div className="absolute inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-xl z-30 flex flex-col" style={{ top: 0 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h3 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Build History</h3>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {[
              { num: 24, label: "Current", status: "running", progress: Math.round(overallProgress), time: "Running now", modules: 9, agent: "CodeSage" },
              { num: 23, label: "Auth refactor", status: "done", progress: 100, time: "Aug 25 14:32", modules: 9, agent: "SpecBot" },
              { num: 22, label: "API contract v2", status: "failed", progress: 67, time: "Aug 24 09:18", modules: 6, agent: "ContractBot" },
            ].map((b) => (
              <div key={b.num} className={`border rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all ${b.num === 24 ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-slate-900">#{b.num}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                      b.status === "running" ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : b.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                    }`}>{b.status === "running" ? "Running" : b.status === "done" ? "Passed" : "Failed"}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">{b.progress}%</span>
                </div>
                <p className="text-[12px] text-slate-600 font-medium mb-1">{b.label}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <Clock size={10} /> {b.time}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 mt-2.5">
                  <div className={`h-1 rounded-full ${b.status === "failed" ? "bg-red-400" : "bg-indigo-500"}`} style={{ width: `${b.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ModuleCard ───────────────────────────────────────────────────────────────

function ModuleCard({ module: mod, canControl, tick }: { module: Module; canControl: boolean; tick: number }) {
  const [expanded, setExpanded] = useState(false);

  const isActive = mod.status === "working";
  const durationStr = mod.status === "done" ? "45':12\"" : isActive ? `${Math.floor(mod.progress)}':02"` : "00':00\"";
  const agentInitials = mod.agent.slice(0, 2).toUpperCase();

  return (
    <div className={`bg-white border rounded-[12px] shadow-sm flex flex-col transition-all ${
      isActive ? "border-indigo-300 shadow-indigo-50"
      : mod.status === "done" ? "border-slate-200"
      : mod.status === "error" ? "border-red-300"
      : "border-slate-200"
    }`}>
      <div className="p-5">
        {/* Top Metadata */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-slate-900 leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{mod.name}</h3>
              <div className={`w-2 h-2 rounded-full ${MODULE_STATUS_DOT[mod.status]}`} />
            </div>
            <p className="text-[12px] text-slate-400 font-medium mt-0.5">/{mod.agent.toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            {canControl && mod.status === "error" && (
              <button className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline font-medium h-fit mt-1">
                <RotateCcw size={10} /> Retry
              </button>
            )}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
              {mod.icon}
            </div>
          </div>
        </div>

        {/* Middle Info Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
            <Clock size={14} className={isActive ? "text-indigo-500" : "text-slate-400"} /> 
            {durationStr}
          </div>
          
          <div className="flex -space-x-2">
            <div className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold z-30 ${
              isActive ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {agentInitials}
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-700 z-20">
              PR
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-emerald-700 z-10">
              +45
            </div>
          </div>
        </div>

        {/* Progress (original logic) */}
        {mod.status !== "idle" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-slate-500">{mod.currentActivity}</span>
              <span className="text-[11px] font-bold text-slate-700">{Math.round(mod.progress)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${
                  mod.status === "done" ? "bg-emerald-500"
                  : mod.status === "error" ? "bg-red-500"
                  : "bg-indigo-500"
                }`}
                style={{ width: `${mod.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <button 
          onClick={() => setExpanded(!expanded)} 
          className={`w-full py-2.5 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 transition-colors ${
            isActive 
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" 
              : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
        >
          {isActive ? "Join Now" : "View Logs"}
          <ChevronRight size={16} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            {/* Mini log */}
            {mod.logs.length > 0 && (
              <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 space-y-0.5 font-mono">
                {mod.logs.slice(-3).map((log, i) => (
                  <p key={i} className={`text-[10px] leading-relaxed ${i === mod.logs.slice(-3).length - 1 ? "text-slate-700" : "text-slate-400"}`}>
                    {log}
                  </p>
                ))}
              </div>
            )}
            {mod.inputArtifacts.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Inputs</p>
                <div className="flex flex-wrap gap-1">
                  {mod.inputArtifacts.map((a) => (
                    <span key={a} className="text-[10px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {mod.outputArtifacts.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">Outputs</p>
                <div className="flex flex-wrap gap-1">
                  {mod.outputArtifacts.map((a) => (
                    <span key={a} className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      mod.status === "done" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-slate-50 border-slate-200"
                    }`}>{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
