import { useId } from 'react';
import { Agent, Squad } from '@/shared/types';

export type ExecutionOwner = { type: 'agent' | 'squad'; id: string };

export function ExecutionOwnerSelect({ value, onChange, agents, squads, required = false, label = 'Assigned to', disabled = false }: {
  value: ExecutionOwner | null;
  onChange: (value: ExecutionOwner | null) => void;
  agents: Agent[];
  squads: Squad[];
  required?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const eligibleAgents = agents.filter(agent => !agent.isArchived);
  const missing = value && !(value.type === 'agent' ? eligibleAgents : squads).some(item => item.id === value.id);
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-xs font-medium text-gray-300">{label}{required && <span className="ml-1 text-brand-300" aria-hidden="true">*</span>}</label>
    <select id={id} required={required} disabled={disabled} value={value ? `${value.type}:${value.id}` : ''}
      onChange={event => { const raw = event.target.value; const separator = raw.indexOf(':'); onChange(raw ? { type: raw.slice(0, separator) as ExecutionOwner['type'], id: raw.slice(separator + 1) } : null); }}
      aria-describedby={`${id}-hint`}
      className="w-full min-w-0 rounded-xl border border-white/10 bg-surface px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-brand-400 disabled:opacity-50">
      <option value="">{required ? 'Choose an agent or squad…' : 'Unassigned'}</option>
      {missing && <option value={`${value.type}:${value.id}`} disabled>Current {value.type} unavailable</option>}
      <optgroup label="Squads">{squads.map(squad => <option key={squad.id} value={`squad:${squad.id}`}>{squad.name} · {squad.memberAgentIds.length} {squad.memberAgentIds.length === 1 ? 'agent' : 'agents'}</option>)}</optgroup>
      <optgroup label="Agents">{eligibleAgents.map(agent => <option key={agent.id} value={`agent:${agent.id}`}>{agent.name} · {agent.role}</option>)}</optgroup>
    </select>
    <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-gray-500">{!eligibleAgents.length && !squads.length ? 'Create an agent or squad in this workspace to continue.' : 'Choose one agent for focused work or a squad for orchestrated execution.'}</p>
  </div>;
}
