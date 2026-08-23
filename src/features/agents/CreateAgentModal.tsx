import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { AgentRole, ModelProvider, AgentAccessLevel } from '@/shared/types';
import { providerOptions, modelsForProvider, defaultModelFor } from '@/shared/lib/providers';
import { Sparkles, Bot, Wand2, ArrowRight } from 'lucide-react';

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ isOpen, onClose }) => {
  const { createAgent, skills, runtimes } = useApp();

  // Mode: 'choice' (initial screen) | 'blank' | 'ai'
  const [creationMode, setCreationMode] = useState<'choice' | 'blank' | 'ai'>('choice');

  // AI Prompt Builder State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Form Fields (Required: Name & Runtime)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<AgentRole>('Coder');
  const runtimeId = runtimes[0]?.id || 'rt-local-ollama';
  const [machineName, setMachineName] = useState('Local Mac Studio M2');
  const [modelProvider, setModelProvider] = useState<ModelProvider>('Anthropic');
  // Seeded from the runtime scan so a new agent never starts on a dead model id.
  const [modelName, setModelName] = useState(() => defaultModelFor(runtimes, 'Anthropic'));
  const [allowedUsers, setAllowedUsers] = useState<AgentAccessLevel>('team');
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are an autonomous engineering specialist. Focus on high precision, defensive programming, clean code, and comprehensive validation.'
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['sk-fs', 'sk-code-exec', 'sk-bash']);

  const handleReset = () => {
    setCreationMode('choice');
    setName('');
    setDescription('');
    setAiPrompt('');
    setIsGenerating(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);

    // Simulate intelligent AI persona generation
    await new Promise(r => setTimeout(r, 900));

    const promptLower = aiPrompt.toLowerCase();
    let genName = 'Aria Pulse';
    let genRole: AgentRole = 'Coder';
    let genDesc = 'Frontend and UI/UX specialist focused on high performance web interfaces.';
    let genModelProv: ModelProvider = 'Anthropic';
    let genModelName = '';
    let genSkills = ['sk-fs', 'sk-browser', 'sk-bash'];
    let genSystemPrompt = `You are an expert AI persona tailored for: "${aiPrompt.trim()}". Maintain high engineering standards and concise responses.`;

    if (promptLower.includes('review') || promptLower.includes('security')) {
      genName = 'Aegis Sentinel';
      genRole = 'Reviewer';
      genDesc = 'Security audit and static analysis specialist for PR reviews.';
      genModelProv = 'DeepSeek';
      genSkills = ['sk-git', 'sk-fs', 'sk-code-exec'];
      genSystemPrompt = 'You are Aegis, a strict Code and Security Reviewer. Scrutinize PR diffs for injection flaws, race conditions, memory leaks, and anti-patterns.';
    } else if (promptLower.includes('architect') || promptLower.includes('design') || promptLower.includes('rfc')) {
      genName = 'Nexus Architect';
      genRole = 'Architect';
      genDesc = 'Distributed system design, API contracts & RFC architect.';
      genModelProv = 'Anthropic';
      genSkills = ['sk-fs', 'sk-git', 'sk-mcp-postgres'];
      genSystemPrompt = 'You are Nexus, a Principal System Architect. Decompose user requirements into clean distributed bounded contexts.';
    } else if (promptLower.includes('qa') || promptLower.includes('test') || promptLower.includes('playwright')) {
      genName = 'Vanguard QA';
      genRole = 'QA Tester';
      genDesc = 'Playwright automated end-to-end testing and regression validation.';
      genModelProv = 'Ollama';
      genSkills = ['sk-browser', 'sk-code-exec', 'sk-bash'];
      genSystemPrompt = 'You are Vanguard, an automated QA Engineer. Generate end-to-end Playwright tests, edge-case fuzzing matrices, and verify regression boundaries.';
    } else if (promptLower.includes('devops') || promptLower.includes('docker') || promptLower.includes('ci/cd') || promptLower.includes('deploy')) {
      genName = 'Helix SRE';
      genRole = 'DevOps Engineer';
      genDesc = 'Container orchestration, CI/CD pipelines & zero-downtime releases.';
      genModelProv = 'Google Gemini';
      genSkills = ['sk-bash', 'sk-git', 'sk-docker', 'sk-cloud'];
      genSystemPrompt = 'You are Helix, an SRE and CI/CD Automation Engineer. Manage Docker containerization and release verification.';
    }

    setName(genName);
    setDescription(genDesc);
    setRole(genRole);
    setModelProvider(genModelProv);
    // Resolve against what is actually installed rather than a baked-in id.
    setModelName(genModelName || defaultModelFor(runtimes, genModelProv));
    setSelectedSkills(genSkills);
    setSystemPrompt(genSystemPrompt);

    setIsGenerating(false);
    setCreationMode('blank');
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createAgent({
      name: name.trim(),
      description: description.trim() || `${role} specialist configured for autonomous task execution.`,
      role,
      owner: 'You',
      isMine: true,
      allowedUsers,
      machineStatus: 'online',
      workStatus: 'idle',
      machineName,
      lastActive: 'Just now',
      isArchived: false,
      concurrencyLimit,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 90000000)}?w=150&auto=format&fit=crop&q=80`,
      color: '#6366f1',
      modelProvider,
      modelName: modelName.trim(),
      runtimeId,
      systemPrompt: systemPrompt.trim(),
      autonomyLevel: 'Semi-Autonomous (Requires Approval)',
      temperature: 0.2,
      skills: selectedSkills,
      envVars: [],
      mcpServers: ['filesystem', 'bash'],
      customCliArgs: ''
    });

    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Hire New Autonomous Agent"
      subtitle="Deploy a new persona into your orchestration cluster with specialized skills and runtime bindings."
    >
      {creationMode === 'choice' ? (
        /* Choice Screen: Start Blank vs Build with AI */
        <div className="space-y-4 py-2">
          <div className="text-xs text-gray-300 font-medium">
            How would you like to configure your new agent?
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option 1: Start Blank */}
            <button
              type="button"
              onClick={() => setCreationMode('blank')}
              className="p-5 rounded-2xl bg-surface-200 border border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all text-left space-y-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white group-hover:bg-brand-500 transition-colors">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-300">Start Blank</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Fill in the configuration yourself with sensible default settings.
                </p>
              </div>
              <div className="text-xs text-brand-400 font-semibold flex items-center gap-1">
                <span>Configure Form</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Option 2: Build with AI */}
            <button
              type="button"
              onClick={() => setCreationMode('ai')}
              className="p-5 rounded-2xl bg-surface-200 border border-brand-500/30 hover:border-brand-500/70 hover:bg-brand-500/10 transition-all text-left space-y-3 group shadow-glow-brand"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center justify-center group-hover:bg-brand-500 group-hover:text-white transition-colors">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white group-hover:text-brand-300">Build with AI</h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300">Prompt</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Describe what you need in plain text. AI fills in instructions, model, and skills.
                </p>
              </div>
              <div className="text-xs text-brand-400 font-semibold flex items-center gap-1">
                <span>Prompt Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>
        </div>
      ) : creationMode === 'ai' ? (
        /* AI Prompt Screen */
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" />
              <span>Describe the Agent You Need</span>
            </label>
            <textarea
              rows={4}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. A senior frontend reviewer who checks React & Tailwind components for accessibility, state performance, and clean TypeScript props."
              className="w-full bg-surface-200 border border-white/10 rounded-xl p-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-sans"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="text-gray-500">Quick ideas:</span>
            {['Frontend Reviewer', 'Playwright QA Tester', 'Rust SRE Architect', 'Issue Triager'].map(idea => (
              <button
                key={idea}
                type="button"
                onClick={() => setAiPrompt(`A specialized ${idea} to automate verification tasks.`)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              >
                {idea}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setCreationMode('choice')}
              className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={isGenerating || !aiPrompt.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-glow-brand transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Persona...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Agent Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Blank / Generated Form */
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Required: Name & Runtime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Agent Name <span className="text-rose-400">* (Required)</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sentinel Prime"
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Machine / Runtime <span className="text-rose-400">* (Required)</span>
              </label>
              <select
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Local Mac Studio M2">Local Mac Studio M2 (Local Engine)</option>
                <option value="AWS Cloud Cluster">AWS Cloud Cluster (Remote GPU)</option>
                <option value="Ollama GPU Pod">Ollama GPU Pod (Self-Hosted)</option>
                <option value="Google Cloud Engine">Google Cloud Engine (High Concurrency)</option>
              </select>
            </div>
          </div>

          {/* Description / Specialization */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              One-Line Specialization
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Fullstack TypeScript/Rust developer & reactive WebSockets engineer"
              className="w-full bg-surface-200 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Role, Model Provider & Model Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgentRole)}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="Architect">Architect</option>
                <option value="Coder">Coder</option>
                <option value="Reviewer">Reviewer</option>
                <option value="QA Tester">QA Tester</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Researcher">Researcher</option>
                <option value="Triager">Triager</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Provider
              </label>
              <select
                value={modelProvider}
                onChange={(e) => {
                  const prov = e.target.value as ModelProvider;
                  setModelProvider(prov);
                  // Detected model, never a hardcoded guess.
                  setModelName(defaultModelFor(runtimes, prov));
                }}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {providerOptions(runtimes).map(opt => (
                  <option key={opt.provider} value={opt.provider}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Model Name
              </label>
              {(() => {
                const available = modelsForProvider(runtimes, modelProvider);
                if (!available.length) {
                  return (
                    <input
                      type="text"
                      required
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="no models detected — type an id"
                      className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                    />
                  );
                }
                return (
                  <select
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  >
                    {modelName && !available.includes(modelName) && (
                      <option value={modelName}>{modelName} (not detected)</option>
                    )}
                    {available.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                );
              })()}
            </div>
          </div>

          {/* Access / Who can use them & Concurrency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Who Can Use This Agent?
              </label>
              <select
                value={allowedUsers}
                onChange={(e) => setAllowedUsers(e.target.value as AgentAccessLevel)}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="everyone">Everyone in Workspace</option>
                <option value="team">Team Members Only</option>
                <option value="admins">Admins Only</option>
                <option value="private">Private (Only Me)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Concurrency Limit (Tasks)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(parseInt(e.target.value) || 1)}
                className="w-full bg-surface-200 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
              System Instructions
            </label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-surface-200 border border-white/10 rounded-lg p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 font-mono"
            />
          </div>

          {/* Skills Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Attached Skills & MCP Tools ({selectedSkills.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 bg-surface-300/60 rounded-lg border border-white/5">
              {skills.map((skill) => {
                const isChecked = selectedSkills.includes(skill.id);
                return (
                  <button
                    type="button"
                    key={skill.id}
                    onClick={() => toggleSkill(skill.id)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-all border ${
                      isChecked 
                        ? 'bg-brand-500/20 text-white border-brand-500/40' 
                        : 'bg-surface-200 text-gray-400 border-transparent hover:border-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      readOnly
                      className="mt-0.5 accent-brand-500 rounded"
                    />
                    <div className="truncate">
                      <div className="font-medium text-white truncate">{skill.name}</div>
                      <div className="text-[10px] text-gray-400 capitalize">{skill.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setCreationMode('choice')}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to options
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-glow-brand transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Deploy Agent</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
