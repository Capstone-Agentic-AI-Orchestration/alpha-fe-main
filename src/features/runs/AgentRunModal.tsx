import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bot, Check, ChevronDown, GitBranch, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { PrototypeRun } from '@/shared/types';
import { Modal } from '@/shared/components/Modal';

export const AgentRunModal: React.FC = () => {
  const {
    runSetupIssueId,
    runSetupAgentId,
    closeRunSetup,
    issues,
    projects,
    agents,
    startPrototypeRun
  } = useApp();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [scenario, setScenario] = useState<PrototypeRun['scenario']>('success');
  const [planReady, setPlanReady] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);

  const issue = issues.find(item => item.id === runSetupIssueId);
  const project = projects.find(item => item.id === issue?.projectId);

  const plan = useMemo(() => {
    if (!issue) return [];
    const taskFocus = issue.subtasks.length > 0
      ? `Address ${issue.subtasks.length} defined subtask${issue.subtasks.length === 1 ? '' : 's'} and preserve the acceptance criteria.`
      : 'Translate the issue description into a focused implementation checklist.';
    return [
      `Review ${issue.identifier} and identify the smallest safe change.`,
      taskFocus,
      'Apply the change in an isolated prototype branch.',
      'Run type checks and the simulated regression suite.',
      'Prepare a concise change summary for human approval.'
    ];
  }, [issue]);

  useEffect(() => {
    if (!runSetupIssueId) return;
    setSelectedAgentId(runSetupAgentId || agents[0]?.id || '');
    setScenario('success');
    setShowDemoOptions(false);
    setPlanReady(false);
    const timer = window.setTimeout(() => setPlanReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [runSetupIssueId, runSetupAgentId, agents]);

  if (!issue) return null;

  const repository = project?.resources?.[0];
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
  const canStart = Boolean(selectedAgent && planReady);

  return (
    <Modal
      isOpen={Boolean(runSetupIssueId)}
      onClose={closeRunSetup}
      title={`Prepare run for ${issue.identifier}`}
      subtitle="Review the context and approve the simulated execution plan."
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        <div className="grid gap-4 border-b border-white/[0.06] pb-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium text-gray-500">Issue</p>
            <p className="mt-1 text-sm font-medium text-white">{issue.title}</p>
            <p className="mt-1 text-xs text-gray-500">{project?.name || 'Unassigned project'}</p>
          </div>
          <div>
            <label htmlFor="prototype-run-agent" className="text-[11px] font-medium text-gray-500">
              Assigned agent
            </label>
            <div className="relative mt-1">
              <Bot className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <select
                id="prototype-run-agent"
                value={selectedAgentId}
                onChange={event => setSelectedAgentId(event.target.value)}
                className="w-full appearance-none border border-white/[0.08] bg-shell py-2 pl-9 pr-8 text-sm text-white focus:border-brand-400 focus:outline-none"
              >
                <option value="">Select an agent</option>
                {agents.filter(agent => !agent.isArchived).map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 text-xs leading-relaxed">
          <GitBranch className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
          <div>
            <p className="font-medium text-gray-300">Repository context</p>
            <p className="mt-0.5 text-gray-500">
              {repository
                ? `${repository.name} · ${repository.branchOrMachine || 'default branch'}`
                : 'No repository is attached. The run will use a simulated workspace for this prototype.'}
            </p>
          </div>
        </div>

        {(!issue.description.trim() || !repository) && (
          <div className="flex items-start gap-3 border-y border-amber-400/15 py-3 text-xs leading-relaxed text-amber-200/80">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <p>
              {!issue.description.trim()
                ? 'Add an issue description for a stronger plan. You can still continue with the prototype.'
                : 'Repository actions are simulated because this project has no connected resource.'}
            </p>
          </div>
        )}

        <section aria-labelledby="generated-plan-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-400" />
              <h4 id="generated-plan-title" className="text-sm font-semibold text-white">Proposed plan</h4>
            </div>
            <span className="text-[11px] text-gray-500">Review before execution</span>
          </div>

          {!planReady ? (
            <div className="flex min-h-36 items-center justify-center gap-2 border-y border-white/[0.06] text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
              Preparing a focused plan…
            </div>
          ) : (
            <ol className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {plan.map((item, index) => (
                <li key={item} className="flex gap-3 py-3 text-sm leading-relaxed text-gray-300">
                  <span className="w-5 flex-shrink-0 text-xs tabular-nums text-gray-600">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div>
          <button
            type="button"
            onClick={() => setShowDemoOptions(value => !value)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
            aria-expanded={showDemoOptions}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showDemoOptions ? 'rotate-180' : ''}`} />
            Demo scenario
          </button>
          {showDemoOptions && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="prototype-scenario"
                  checked={scenario === 'success'}
                  onChange={() => setScenario('success')}
                  className="accent-indigo-500"
                />
                Successful run
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="prototype-scenario"
                  checked={scenario === 'test_failure'}
                  onChange={() => setScenario('test_failure')}
                  className="accent-indigo-500"
                />
                Test failure and retry
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={closeRunSetup}
            className="px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => selectedAgent && startPrototypeRun(issue.id, selectedAgent.id, plan, scenario)}
            className="flex items-center gap-2 bg-brand-500 px-4 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            title={!selectedAgent ? 'Select an agent to continue' : undefined}
          >
            <Check className="h-4 w-4" />
            Approve and start
          </button>
        </div>
      </div>
    </Modal>
  );
};
