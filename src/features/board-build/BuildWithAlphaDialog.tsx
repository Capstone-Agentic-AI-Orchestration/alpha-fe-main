import React, { useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';
import { isDesktop } from '@/shared/desktop';
import type { Issue } from '@/shared/types';
import { useFeatureSpec } from './useTaskBuild';

export type BuildWorker = 'alpha' | 'agent';
export type BuildStart = 'plan' | 'spec';

/** What follows each choice, in the order it happens. */
export function buildWithAlphaSteps(worker: BuildWorker, start: BuildStart): string[] {
  if (worker === 'agent') {
    return [
      'You review the agent\'s checklist for this task.',
      'The agent works in this project\'s copy of the code on this computer.',
      'You approve its changes before they go any further.',
    ];
  }
  if (start === 'spec') {
    return [
      'Alpha drafts a spec for this task: requirements and user journeys.',
      'You answer its questions and approve the spec.',
      'Then Build with Alpha again: the plan follows the approved spec.',
    ];
  }
  return [
    'Alpha reads the code it needs and proposes a plan.',
    'You approve the plan or ask for changes.',
    'Agents build it on a separate branch.',
    'You review the result, then publish it.',
  ];
}

interface BuildWithAlphaDialogProps {
  issue: Issue;
  submitting: boolean;
  onPlan: (instructions: string) => void;
  onSpecFirst: () => void;
  onPickAgent: (agentId: string) => void;
  onClose: () => void;
}

/**
 * The one way to start agent work on a task.
 *
 * Every choice hands off to what already existed: the Orchestrator build (startIssueBuild), the
 * feature spec draft (FeatureSpecPanel), and the single-agent run setup (AgentRunModal). Only
 * the way in is new.
 */
export const BuildWithAlphaDialog: React.FC<BuildWithAlphaDialogProps> = ({ issue, submitting, onPlan, onSpecFirst, onPickAgent, onClose }) => {
  const { can, agents } = useApp();
  const ids = useId();
  const spec = useFeatureSpec(issue, isDesktop);
  const runnableAgents = agents.filter(agent => !agent.isArchived);
  const canPickAgent = can('run_agents') && runnableAgents.length > 0;
  const canWriteSpec = can('run_builds') && can('manage_chat');
  const [worker, setWorker] = useState<BuildWorker>('alpha');
  const [start, setStart] = useState<BuildStart>('plan');
  const [agentId, setAgentId] = useState(issue.assignedAgentId ?? runnableAgents[0]?.id ?? '');
  const [instructions, setInstructions] = useState('');

  const record = spec.record;
  const specStale = Boolean(record && record.status === 'approved' && record.stale);
  const specNote = !record ? ''
    : record.status !== 'approved' ? 'This task has a draft spec. Approve it in the task so the plan follows it.'
      : specStale ? 'The task changed after its spec was approved. Approve the spec again before building.'
        : 'The plan will follow this task\'s approved spec.';
  // A task with a spec already has its "spec first" step; it shows in the task instead.
  const offersSpec = canWriteSpec && spec.loaded && !record;
  const shownStart: BuildStart = worker === 'alpha' && offersSpec ? start : 'plan';
  const blocked = worker === 'agent' ? !agentId : shownStart === 'plan' && specStale;
  const primaryLabel = worker === 'agent' ? 'Set up the run' : shownStart === 'spec' ? 'Write the spec' : submitting ? 'Requesting plan…' : 'Plan build';

  const submit = () => {
    if (blocked || submitting) return;
    if (worker === 'agent') onPickAgent(agentId);
    else if (shownStart === 'spec') onSpecFirst();
    else onPlan(instructions);
  };

  const option = (name: string, value: string, checked: boolean, onChange: () => void, label: string, detail: string, disabled = false) => (
    <label className={'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ' + (checked ? 'border-control bg-selected' : 'border-divider hover:bg-surface-high') + (disabled ? ' cursor-not-allowed opacity-50' : '')}>
      <input type="radio" name={ids + name} value={value} checked={checked} disabled={disabled} onChange={onChange} className="mt-0.5 accent-brand-500" />
      <span><span className="block text-[13px] font-medium text-content">{label}</span><span className="block text-[12px] text-content-muted">{detail}</span></span>
    </label>
  );

  return (
    <Modal isOpen onClose={onClose} closeDisabled={submitting} title={'Build ' + issue.identifier + ' with Alpha'} maxWidth="max-w-lg"
      subtitle={issue.title}
      footer={<div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-divider px-3.5 py-2 text-sm font-medium text-content-secondary hover:bg-surface-high hover:text-content">Cancel</button>
        <button type="button" onClick={submit} disabled={blocked || submitting} className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3.5 py-2 text-sm font-semibold text-on-action hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50">
          {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}{primaryLabel}
        </button>
      </div>}>
      <div className="space-y-4">
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-[12px] font-semibold text-content-secondary">Who does the work</legend>
          {option('worker', 'alpha', worker === 'alpha', () => setWorker('alpha'), 'Let Alpha choose (recommended)', 'Alpha plans the task and gives each part to the right agent.')}
          {option('worker', 'agent', worker === 'agent', () => setWorker('agent'), 'One agent I pick', 'Quickest for a small task one specialist can do alone.', !canPickAgent)}
          {worker === 'agent' && (
            <select aria-label="Agent" value={agentId} onChange={event => setAgentId(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-control bg-well px-2.5 text-[13px] text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {runnableAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>)}
            </select>
          )}
        </fieldset>

        {worker === 'alpha' && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-[12px] font-semibold text-content-secondary">Start with</legend>
            {option('start', 'plan', shownStart === 'plan', () => setStart('plan'), 'A plan you approve', 'Alpha proposes the work; nothing changes until you approve it.')}
            {offersSpec && option('start', 'spec', shownStart === 'spec', () => setStart('spec'), 'A written spec first', 'For bigger or unclear tasks: agree on requirements before planning.')}
            {specNote && <p className={'text-[12px] ' + (specStale || record?.status !== 'approved' ? 'text-status-warning' : 'text-content-secondary')}>{specNote}</p>}
          </fieldset>
        )}

        {worker === 'alpha' && shownStart === 'plan' && (
          <div>
            <label htmlFor={ids + '-instructions'} className="block text-[12px] font-semibold text-content-secondary">Instructions for Alpha <span className="font-normal text-content-muted">(optional)</span></label>
            <textarea id={ids + '-instructions'} rows={3} maxLength={1500} value={instructions} onChange={event => setInstructions(event.target.value)}
              placeholder="Add technical context, implementation guidance, or constraints for this task."
              className="mt-1.5 w-full resize-y rounded-md border border-control bg-well px-3 py-2 text-sm text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-content-secondary">What happens next</p>
          <ol className="space-y-1.5">
            {buildWithAlphaSteps(worker, shownStart).map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-[13px] text-content-secondary">
                <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-high text-[11px] font-semibold text-content">{index + 1}</span>{step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
};

