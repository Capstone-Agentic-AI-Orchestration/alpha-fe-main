import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { 
  Key, 
  Server, 
  Save, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Layers,
  Shield,
  Plug,
  Users
} from 'lucide-react';
import { AgentAutonomyLevel } from '@/shared/types';
import { GitHubConnectionPanel } from './GitHubConnectionPanel';
import { McpServersPanel } from './McpServersPanel';
import { WorkspaceAccessPanel } from './WorkspaceAccessPanel';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings, role, can } = useApp();
  const canManageSettings = can('manage_settings');
  const canManageMcp = can('manage_mcp');
  const [requestedTab, setActiveTab] = useState<'general' | 'members' | 'project_access' | 'integrations' | 'keys' | 'runtimes' | 'autonomy'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    workspaceName: settings.workspaceName,
    workspaceSlug: settings.workspaceSlug,
    localRuntimeUrl: settings.localRuntimeUrl,
    defaultAutonomy: settings.defaultAutonomy,
    enableAutoTriage: settings.enableAutoTriage,
    notificationsEnabled: settings.notificationsEnabled,
    telemetryEnabled: settings.telemetryEnabled,
    maxParallelAgentRuns: settings.maxParallelAgentRuns,
    apiKeys: { ...settings.apiKeys }
  });

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Secrets and agent governance belong to whoever administers the workspace.
  // A client's settings are their own profile and how they want to be contacted.
  const allTabs = [
    { id: 'general', label: 'Workspace General', icon: <Layers className="w-4 h-4" />, roles: ['client', 'dev', 'pm', 'admin'] },
    { id: 'members', label: 'Members & Roles', icon: <Users className="w-4 h-4" />, roles: ['pm', 'admin'] },
    { id: 'project_access', label: 'Project Access', icon: <Shield className="w-4 h-4" />, roles: ['pm', 'admin'] },
    // Connecting GitHub is per-person and per-machine, so anyone who ships
    // code needs it — not just whoever administers the workspace.
    { id: 'integrations', label: 'Connected Accounts', icon: <Plug className="w-4 h-4 text-emerald-400" />, roles: ['dev', 'pm', 'admin'] },
    { id: 'keys', label: 'API Keys Vault', icon: <Key className="w-4 h-4 text-amber-400" />, roles: ['admin'] },
    { id: 'runtimes', label: 'Local Inference Engine', icon: <Server className="w-4 h-4 text-teal-400" />, roles: ['pm', 'admin'] },
    { id: 'autonomy', label: 'Autonomy Governance', icon: <Shield className="w-4 h-4 text-indigo-400" />, roles: ['pm', 'admin'] },
  ];
  const tabs = allTabs.filter(t => t.roles.includes(role));

  // A tab this role may not open resolves to the first one it can, derived
  // rather than stored so no render-time state write is needed.
  const activeTab = tabs.some(t => t.id === requestedTab)
    ? requestedTab
    : (tabs[0]?.id as typeof requestedTab);
  const isAccessTab = activeTab === 'members' || activeTab === 'project_access';

  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-background">
      {/* Settings Navigation Sidebar */}
      <div className="w-full md:w-64 bg-surface-200/50 border-r border-white/10 p-4 space-y-1 flex-shrink-0">
        <div className="text-xs font-bold uppercase tracking-wider text-white px-3 py-2 mb-2">
          Settings & Config
        </div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-500 text-on-accent shadow-glow-brand font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Settings Content Area */}
      <div className="max-w-5xl flex-1 space-y-5 overflow-y-auto p-6 md:p-7">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white capitalize">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure system parameters and preferences for your Alpha workspace.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Saved!</span>
            </div>
          )}
        </div>

        {isAccessTab ? (
          <WorkspaceAccessPanel mode={activeTab === 'members' ? 'members' : 'project_access'} />
        ) : (
        <form onSubmit={handleSave} className="space-y-5">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4 rounded-2xl border border-white/10 bg-surface-200/50 p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Workspace Name</label>
                  <input
                    type="text"
                    value={formData.workspaceName}
                    disabled={!canManageSettings}
                    onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Workspace Slug</label>
                  <input
                    type="text"
                    value={formData.workspaceSlug}
                    disabled={!canManageSettings}
                    onChange={(e) => setFormData({ ...formData, workspaceSlug: e.target.value })}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Max Parallel Agent Runs</label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={formData.maxParallelAgentRuns}
                    disabled={!canManageSettings}
                    onChange={(e) => setFormData({ ...formData, maxParallelAgentRuns: parseInt(e.target.value) || 4 })}
                    className="w-32 bg-surface-100 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* System Updates & Launcher Card */}
                <div className="pt-4 border-t border-white/10">
                  <div className="p-4 rounded-xl bg-well border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Alpha Core Platform
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 mt-0.5">Version 2.0.0 · Local Daemon (Port 3001)</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono font-medium">
                        Up to date
                      </span>
                    </div>

                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      All agent runs, 5-stage stream updates, and GitHub Actions events are broadcast in real-time over WebSockets.
                    </p>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSavedSuccess(true);
                          setTimeout(() => setSavedSuccess(false), 2500);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white font-medium transition-colors"
                      >
                        Check for Updates
                      </button>
                      <span className="text-[11px] text-gray-500 font-mono">1-Click Launcher: <code>start-alpha.bat</code></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connected Accounts: external wiring, per machine. GitHub is an
              account Alpha signs into; MCP servers are tools it may spawn.
              Both are 'what this machine can reach', so they share a tab. */}
          {activeTab === 'integrations' && (
            <div className="space-y-8">
              <GitHubConnectionPanel />
              {canManageMcp && (
                <div className="border-t border-white/5 pt-6">
                  <McpServersPanel />
                </div>
              )}
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2 leading-relaxed">
                Stored as plain text in this browser&apos;s local storage — not encrypted.
                Prefer signing into a local CLI (see Connected Accounts) so no key is
                held here at all.
              </p>

              <div className="space-y-3">
                {[
                  { id: 'anthropic', label: 'Anthropic Claude API Key', placeholder: 'sk-ant-api03-...' },
                  { id: 'openai', label: 'OpenAI API Key', placeholder: 'sk-proj-...' },
                  { id: 'gemini', label: 'Google Gemini API Key', placeholder: 'AIzaSy...' },
                  { id: 'groq', label: 'Groq Cloud API Key', placeholder: 'gsk_...' },
                  { id: 'huggingface', label: 'Hugging Face Token', placeholder: 'hf_...' },
                ].map((k) => (
                  <div key={k.id} className="relative">
                    <label className="block text-xs font-semibold text-gray-300 mb-1">{k.label}</label>
                    <div className="relative flex items-center">
                      <input
                        type={showKeys[k.id] ? 'text' : 'password'}
                        value={(formData.apiKeys as any)[k.id] || ''}
                        disabled={!canManageSettings}
                        onChange={(e) => setFormData({
                          ...formData,
                          apiKeys: { ...formData.apiKeys, [k.id]: e.target.value }
                        })}
                        placeholder={k.placeholder}
                        className="w-full bg-surface-100 border border-white/10 rounded-lg pl-3.5 pr-10 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(k.id)}
                        className="absolute right-3 text-gray-400 hover:text-white p-0.5"
                      >
                        {showKeys[k.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Local Runtimes Tab */}
          {activeTab === 'runtimes' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Local Ollama Host Endpoint</label>
                <input
                  type="text"
                  value={formData.localRuntimeUrl}
                  disabled={!canManageSettings}
                  onChange={(e) => setFormData({ ...formData, localRuntimeUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full bg-surface-100 border border-white/10 rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-surface-100 border border-white/5 space-y-2">
                <div className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                  <Server className="w-4 h-4" /> Local Engine Probe
                </div>
                <p className="text-[11px] text-gray-400">
                  When enabled, Alpha polls `http://localhost:11434/api/tags` and `http://localhost:1234/v1/models` every 30s to discover newly downloaded models.
                </p>
              </div>
            </div>
          )}

          {/* Autonomy Governance Tab */}
          {activeTab === 'autonomy' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">Default Agent Autonomy Tier</label>
                <select
                  value={formData.defaultAutonomy}
                  disabled={!canManageSettings}
                  onChange={(e) => setFormData({ ...formData, defaultAutonomy: e.target.value as AgentAutonomyLevel })}
                  className="w-full bg-surface-100 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Supervised">Supervised (Human Step-by-Step Confirmation)</option>
                  <option value="Semi-Autonomous (Requires Approval)">Semi-Autonomous (Requires Approval for Merging)</option>
                  <option value="Full Autonomy">Full Autonomy (Autonomous Commit & Deploy)</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enableAutoTriage}
                    disabled={!canManageSettings}
                    onChange={(e) => setFormData({ ...formData, enableAutoTriage: e.target.checked })}
                    className="accent-brand-500 rounded"
                  />
                  <span className="text-xs text-gray-200">
                    Enable <b>Atlas Prime AI Auto-Triage</b> for newly queued issues
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.telemetryEnabled}
                    disabled={!canManageSettings}
                    onChange={(e) => setFormData({ ...formData, telemetryEnabled: e.target.checked })}
                    className="accent-brand-500 rounded"
                  />
                  <span className="text-xs text-gray-200">
                    Collect local inference latency and run telemetry for operational analytics
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!canManageSettings}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-on-accent font-medium text-xs shadow-glow-brand transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};
