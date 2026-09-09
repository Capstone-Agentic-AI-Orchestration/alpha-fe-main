import React, { useState } from 'react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { SquadTopology } from '@/shared/types';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Network
} from 'lucide-react';

interface CreateSquadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQUAD_ICON_PRESETS = ['⚡', '🎨', '🛡️', '🧠', '🚀', '🤖', '🌐', '⚙️', '🎯', '📦', '🔒', '💻'];

export const CreateSquadModal: React.FC<CreateSquadModalProps> = ({ isOpen, onClose }) => {
  const { createSquad, agents } = useApp();

  // Wizard Step State (1: Basics & Mission, 2: Topology & Lead, 3: Members, 4: Review)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Basics & Mission
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('⚡');
  const [mission, setMission] = useState('Coordinate autonomous tasks with high concurrency and fault tolerance.');

  // Step 2: Topology & Leader
  /**
   * Sequential, because it is the only topology the daemon implements.
   *
   * This defaulted to 'hierarchical', so a squad created without touching the
   * picker could never run — the launch panel just reported "hierarchical is
   * not implemented yet" once it was too late to change it.
   */
  const [topology, setTopology] = useState<SquadTopology>('sequential');
  const [leaderAgentId, setLeaderAgentId] = useState(agents[0]?.id || 'agent-1');

  // Step 3: Member Agents
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([agents[0]?.id, agents[1]?.id].filter(Boolean));

  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds(prev => 
      prev.includes(agentId) ? (prev.length > 1 ? prev.filter(a => a !== agentId) : prev) : [...prev, agentId]
    );
  };

  const getTopologyDescription = (top: SquadTopology) => {
    switch (top) {
      case 'sequential': return 'Linear pipeline where Agent A output serves as input context for Agent B.';
      // Described in the future tense on purpose: these are designs, not
      // behaviour, and the picker disables them for that reason.
      case 'hierarchical': return 'Not implemented. Would have a leader delegate to workers and aggregate the results.';
      case 'swarm': return 'Not implemented. Would run peer agents asynchronously over shared memory.';
      case 'consensus': return 'Not implemented. Would require majority approval before committing.';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createSquad({
      name: name.trim(),
      description: description.trim(),
      avatar,
      color: '#6366f1',
      leaderAgentId,
      memberAgentIds: selectedAgentIds,
      topology,
      mission: mission.trim()
    });

    handleClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setCurrentStep(1);
    onClose();
  };

  const canProceedFromStep1 = name.trim().length > 0 && mission.trim().length > 0;
  const leaderAgent = agents.find(a => a.id === leaderAgentId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Multi-Agent Squad"
      subtitle="Assemble an autonomous team of agents with custom workflow topologies and leader oversight."
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* ================= STEPPER PROGRESS HEADER ================= */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          {[
            { step: 1, label: 'Basics & Mission' },
            { step: 2, label: 'Topology & Lead' },
            { step: 3, label: 'Members' },
            { step: 4, label: 'Review' }
          ].map((item) => {
            const isCompleted = currentStep > item.step;
            const isActive = currentStep === item.step;

            return (
              <div
                key={item.step}
                className={`flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors ${
                  isActive ? 'text-white font-semibold' : isCompleted ? 'text-brand-400' : 'text-gray-500'
                }`}
                onClick={() => {
                  if (item.step < currentStep || (item.step === 2 && canProceedFromStep1)) {
                    setCurrentStep(item.step);
                  }
                }}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono transition-colors ${
                    isActive
                      ? 'bg-brand-500 text-on-accent'
                      : isCompleted
                      ? 'bg-brand-500/20 text-brand-300'
                      : 'bg-surface-raised text-gray-500 border border-white/5'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : item.step}
                </span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* ================= STEP 1: BASICS & MISSION ================= */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-fade-in text-xs">
            {/* Icon Picker & Squad Name */}
            <div className="flex items-start gap-3">
              {/* Icon Picker */}
              <div className="space-y-1">
                <label className="block text-[11px] font-medium text-gray-400">Avatar</label>
                <div className="relative group">
                  <div 
                    className="w-12 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-xl cursor-pointer hover:border-brand-500/50 transition-colors"
                  >
                    {avatar}
                  </div>
                  <div className="absolute top-full left-0 mt-1 p-2 bg-surface-raised border border-white/10 rounded-xl shadow-2xl z-30 hidden group-hover:grid grid-cols-4 gap-1.5 w-40">
                    {SQUAD_ICON_PRESETS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Squad Name */}
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-gray-400 mb-1">
                  Squad Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. SRE Zero-Downtime Swarm"
                  className="w-full bg-surface border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>
            </div>

            {/* Squad Mission / Directive */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-gray-400">
                Squad Mission & Ground Rules Directive <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                placeholder="e.g. Ensure 99.99% system availability and autonomous patch verification."
                className="w-full bg-well border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 leading-relaxed font-mono"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-gray-400">
                Summary Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specialized multi-agent execution squad for continuous uptime..."
                className="w-full bg-surface border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}

        {/* ================= STEP 2: TOPOLOGY & LEAD ================= */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-fade-in text-xs">
            {/* Topology Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-indigo-400" />
                <span>Orchestration Topology</span>
              </label>
              <select
                value={topology}
                onChange={(e) => setTopology(e.target.value as SquadTopology)}
                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                {/*
                  Only Sequential is disabled=false: the other three have no
                  daemon behaviour, and offering them as equal choices is what
                  produced squads that could not be launched.
                */}
                <option value="sequential">Sequential (Step-by-step pipeline)</option>
                <option value="hierarchical" disabled>Hierarchical — not implemented yet</option>
                <option value="swarm" disabled>Swarm — not implemented yet</option>
                <option value="consensus" disabled>Consensus — not implemented yet</option>
              </select>
              <p className="text-[11px] text-gray-400 bg-well p-2.5 rounded-lg border border-white/5 font-mono leading-relaxed">
                {getTopologyDescription(topology)}
              </p>
            </div>

            {/* Squad Leader Agent */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-medium text-gray-400">
                Designated Squad Leader (Coordinator)
              </label>
              <select
                value={leaderAgentId}
                onChange={(e) => {
                  setLeaderAgentId(e.target.value);
                  if (!selectedAgentIds.includes(e.target.value)) {
                    setSelectedAgentIds(prev => [...prev, e.target.value]);
                  }
                }}
                className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    🤖 {a.name} ({a.role} • {a.modelName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ================= STEP 3: ASSEMBLE MEMBERS ================= */}
        {currentStep === 3 && (
          <div className="space-y-3 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-gray-400">
                Squad Members ({selectedAgentIds.length} agents selected)
              </label>
              <span className="text-[10px] text-gray-500 font-mono">Select at least 1 agent</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-well rounded-xl border border-white/5">
              {agents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const isLeader = agent.id === leaderAgentId;

                return (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs transition-colors border ${
                      isSelected 
                        ? 'bg-white/[0.06] text-white border-white/20 shadow-sm' 
                        : 'bg-surface text-gray-400 border-transparent hover:border-white/10'
                    }`}
                  >
                    <img src={agent.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    <div className="truncate flex-1 min-w-0">
                      <div className="font-medium text-white truncate flex items-center gap-1.5">
                        <span>{agent.name}</span>
                        {isLeader && (
                          <span className="text-[9px] bg-white/20 text-white px-1 rounded font-mono font-bold">
                            LEAD
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">{agent.role} • {agent.modelName}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded bg-surface-raised border-white/10 text-brand-500 focus:ring-0 ml-1 flex-shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= STEP 4: REVIEW & FINALIZE ================= */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-fade-in text-xs">
            {/* Overview Card */}
            <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{avatar}</span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{name}</h3>
                  <span className="text-[11px] font-mono text-gray-400 capitalize">{topology} Topology Flow</span>
                </div>
              </div>

              {mission && (
                <p className="text-white bg-well p-2.5 rounded-lg border border-white/5 font-mono text-[11px] leading-relaxed">
                  {mission}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
                <div>
                  <span className="text-gray-500 block">Leader</span>
                  <span className="text-white truncate block">{leaderAgent?.name || 'Assigned'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Topology</span>
                  <span className="text-white capitalize">{topology}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Roster Size</span>
                  <span className="text-white">{selectedAgentIds.length} agents</span>
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-[11px]">
              Ready to assemble. Member agents will collaborate using the {topology} orchestration loop.
            </p>
          </div>
        )}

        {/* ================= STEPPER FOOTER NAVIGATION ================= */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !canProceedFromStep1}
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium disabled:opacity-40 transition-colors shadow-sm"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-on-accent font-semibold shadow-glow-brand transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Form Squad</span>
            </button>
          )}
        </div>

      </form>
    </Modal>
  );
};
