import { useState } from "react";
import { useApp } from "../context/AppContext";
import { Key, Shield, Users, Bell, Eye, EyeOff, Plus, Copy } from "lucide-react";

const TABS = ["API Keys", "Autonomy", "Team", "Notifications"] as const;
type Tab = (typeof TABS)[number];

function ApiKeyRow({ label, keyVal, provider }: { label: string; keyVal: string; provider: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(keyVal).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-400 mt-0.5">{provider}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <code className="text-[12px] text-slate-700 font-mono">
            {visible ? keyVal : keyVal.slice(0, 8) + "••••••••••••••••"}
          </code>
          <button onClick={() => setVisible((v) => !v)} className="text-slate-400 hover:text-slate-700 transition-colors ml-1">
            {visible ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button onClick={handleCopy} className="text-slate-400 hover:text-slate-700 transition-colors">
            <Copy size={12} />
          </button>
        </div>
        <span className="text-[12px] text-slate-400">{copied ? "Copied!" : ""}</span>
        <button className="text-[12px] text-indigo-600 hover:text-indigo-700 font-medium transition-colors">Rotate</button>
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-slate-100">
      <div>
        <p className="text-[13px] font-semibold text-slate-900">{label}</p>
        <p className="text-[12px] text-slate-400 mt-0.5">{sub}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-indigo-600" : "bg-slate-200"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export default function SettingsView() {
  const { team, role } = useApp();
  const [tab, setTab] = useState<Tab>("API Keys");
  const [autonomy, setAutonomy] = useState({
    autoMerge: false, autoDeploy: false, requireReview: true,
    maxTokenBudget: true, agentCreateIssues: true, broadcastMode: false,
  });
  const [notifs, setNotifs] = useState({
    approvals: true, deployments: true, agentAlerts: true,
    mentions: true, weeklyDigest: false, costAlerts: true,
  });

  const ROLE_CLS: Record<string, string> = {
    client: "text-sky-700 bg-sky-50 border border-sky-200",
    dev: "text-emerald-700 bg-emerald-50 border border-emerald-200",
    pm: "text-amber-700 bg-amber-50 border border-amber-200",
    admin: "text-indigo-700 bg-indigo-50 border border-indigo-200",
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white px-6 py-5 border-b border-slate-200">
        <h1 className="text-[20px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Workspace Settings</h1>
        <p className="text-[13px] text-slate-500 mt-1">Governance, API keys, team management, and preferences</p>
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-[13px] rounded-lg transition-colors font-medium ${
                tab === t ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-3xl">
          {tab === "API Keys" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Key size={15} className="text-slate-500" />
                <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>API Keys</h2>
              </div>
              <ApiKeyRow label="Anthropic API Key" keyVal="sk-ant-api03-XGzK8mT..." provider="Used by Anthropic runtime" />
              <ApiKeyRow label="OpenAI API Key" keyVal="sk-proj-L2mT9vXpQ..." provider="Used by OpenAI runtime" />
              <ApiKeyRow label="Supabase Service Key" keyVal="eyJhbGciOiJIUzI1Ni..." provider="Backend persistence" />
              <ApiKeyRow label="GitHub Token" keyVal="ghp_KkRt3Vq8mNp..." provider="Git skill + MCP GitHub" />
              <button className="mt-4 flex items-center gap-2 text-[13px] text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
                <Plus size={13} /> Add new key
              </button>
            </>
          )}
          {tab === "Autonomy" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Shield size={15} className="text-slate-500" />
                <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Autonomy Governance</h2>
              </div>
              <p className="text-[13px] text-slate-500 mb-5">Control how autonomously agents can act. More permissive settings speed up delivery but reduce oversight.</p>
              <ToggleRow label="Require human review before merge" sub="Agent PRs need approval before merging" value={autonomy.requireReview} onChange={(v) => setAutonomy((s) => ({ ...s, requireReview: v }))} />
              <ToggleRow label="Auto-deploy on approval" sub="Trigger deployment after PR merge" value={autonomy.autoDeploy} onChange={(v) => setAutonomy((s) => ({ ...s, autoDeploy: v }))} />
              <ToggleRow label="Allow agents to create issues" sub="Agents can self-assign work from chat" value={autonomy.agentCreateIssues} onChange={(v) => setAutonomy((s) => ({ ...s, agentCreateIssues: v }))} />
              <ToggleRow label="Enforce token budget per run" sub="Abort runs exceeding the token limit" value={autonomy.maxTokenBudget} onChange={(v) => setAutonomy((s) => ({ ...s, maxTokenBudget: v }))} />
              <ToggleRow label="Auto-merge low-risk changes" sub="Typo fixes, doc updates merge without review" value={autonomy.autoMerge} onChange={(v) => setAutonomy((s) => ({ ...s, autoMerge: v }))} />
              <ToggleRow label="Broadcast mode" sub="All agents see all project context (higher cost)" value={autonomy.broadcastMode} onChange={(v) => setAutonomy((s) => ({ ...s, broadcastMode: v }))} />
            </>
          )}
          {tab === "Team" && (
            <>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Users size={15} className="text-slate-500" />
                  <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Team Members</h2>
                </div>
                <button className="flex items-center gap-2 px-3 py-1.5 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium">
                  <Plus size={12} /> Invite Member
                </button>
              </div>
              <div className="space-y-1">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-[12px] font-bold text-slate-700">{member.avatar}</div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-900">{member.name}</p>
                        <p className="text-[11px] text-slate-400">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded capitalize font-semibold ${ROLE_CLS[member.role]}`}>{member.role}</span>
                      {role === "admin" && member.role !== "admin" && (
                        <button className="text-[12px] text-slate-500 hover:text-slate-900 transition-colors font-medium">Edit</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Notifications" && (
            <>
              <div className="flex items-center gap-2 mb-5">
                <Bell size={15} className="text-slate-500" />
                <h2 className="text-[14px] font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Notification Preferences</h2>
              </div>
              <ToggleRow label="Approval requests" sub="Notify when a PR or estimate needs review" value={notifs.approvals} onChange={(v) => setNotifs((s) => ({ ...s, approvals: v }))} />
              <ToggleRow label="Deployment events" sub="Success, failure, and rollback alerts" value={notifs.deployments} onChange={(v) => setNotifs((s) => ({ ...s, deployments: v }))} />
              <ToggleRow label="Agent alerts" sub="Token budget exceeded, errors, stalled runs" value={notifs.agentAlerts} onChange={(v) => setNotifs((s) => ({ ...s, agentAlerts: v }))} />
              <ToggleRow label="Mentions" sub="When someone @mentions you in chat or issues" value={notifs.mentions} onChange={(v) => setNotifs((s) => ({ ...s, mentions: v }))} />
              <ToggleRow label="Cost alerts" sub="Notify when daily spend exceeds $50" value={notifs.costAlerts} onChange={(v) => setNotifs((s) => ({ ...s, costAlerts: v }))} />
              <ToggleRow label="Weekly digest" sub="Sunday summary of activity and metrics" value={notifs.weeklyDigest} onChange={(v) => setNotifs((s) => ({ ...s, weeklyDigest: v }))} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
