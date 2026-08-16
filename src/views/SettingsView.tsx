import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Key, 
  Server, 
  Save, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Layers,
  Shield,
  Palette
} from 'lucide-react';
import { AgentAutonomyLevel } from '../types';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const [activeTab, setActiveTab] = useState<'general' | 'keys' | 'runtimes' | 'autonomy' | 'appearance'>('general');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    workspaceName: settings.workspaceName,
    workspaceSlug: settings.workspaceSlug,
    localRuntimeUrl: settings.localRuntimeUrl,
    activeTheme: settings.activeTheme,
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

  const tabs = [
    { id: 'general', label: 'Workspace General', icon: <Layers className="w-4 h-4" /> },
    { id: 'keys', label: 'API Keys Vault', icon: <Key className="w-4 h-4 text-amber-400" /> },
    { id: 'runtimes', label: 'Local Inference Engine', icon: <Server className="w-4 h-4 text-teal-400" /> },
    { id: 'autonomy', label: 'Autonomy Governance', icon: <Shield className="w-4 h-4 text-indigo-400" /> },
    { id: 'appearance', label: 'Appearance & Themes', icon: <Palette className="w-4 h-4 text-pink-400" /> },
  ];

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
                ? 'bg-brand-500 text-white shadow-glow-brand font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white capitalize">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure system parameters and preferences for your Multica workspace.
            </p>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Saved!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Workspace Name</label>
                  <input
                    type="text"
                    value={formData.workspaceName}
                    onChange={(e) => setFormData({ ...formData, workspaceName: e.target.value })}
                    className="w-full bg-surface-100 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1">Workspace Slug</label>
                  <input
                    type="text"
                    value={formData.workspaceSlug}
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
                    onChange={(e) => setFormData({ ...formData, maxParallelAgentRuns: parseInt(e.target.value) || 4 })}
                    className="w-32 bg-surface-100 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* API Keys Vault Tab */}
          {activeTab === 'keys' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <p className="text-xs text-gray-400">
                Encrypted in browser local storage. These keys are used when invoking cloud models.
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
                  When enabled, Multica polls `http://localhost:11434/api/tags` and `http://localhost:1234/v1/models` every 30s to discover newly downloaded models.
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
                    onChange={(e) => setFormData({ ...formData, telemetryEnabled: e.target.checked })}
                    className="accent-brand-500 rounded"
                  />
                  <span className="text-xs text-gray-200">
                    Collect local inference latency and token telemetry for cost optimization advisor
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Appearance & Themes Tab */}
          {activeTab === 'appearance' && (
            <div className="p-6 rounded-2xl bg-surface-200/50 border border-white/10 space-y-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Theme Palette</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'dark', name: 'Obsidian Dark', border: 'border-brand-500', color: 'bg-[#0B0D13]' },
                  { id: 'midnight', name: 'Midnight Navy', border: 'border-blue-500', color: 'bg-[#0a0f1d]' },
                  { id: 'cyber', name: 'Cyber Violet', border: 'border-purple-500', color: 'bg-[#120824]' },
                ].map(th => (
                  <div
                    key={th.id}
                    onClick={() => setFormData({ ...formData, activeTheme: th.id as any })}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      formData.activeTheme === th.id
                        ? 'border-brand-500 bg-brand-500/10 shadow-glow-brand'
                        : 'border-white/10 hover:border-white/20 bg-surface-100'
                    }`}
                  >
                    <div className={`w-full h-8 rounded-lg ${th.color} border border-white/10`} />
                    <div className="text-xs font-semibold text-white">{th.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium text-xs shadow-glow-brand transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Preferences</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
