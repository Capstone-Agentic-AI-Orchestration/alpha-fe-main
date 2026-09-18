import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  GitBranch,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2
} from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Modal } from '@/shared/components/Modal';

type PlanningStep = 'draft' | 'approval';

export const AgentRunModal: React.FC = () => {
  const {
    runSetupIssueId,
    runSetupAgentId,
    runPlanDrafts,
    saveRunPlanDraft,
    closeRunSetup,
    issues,
    projects,
    agents,
    showToast,
    startPrototypeRun
  } = useApp();
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [planItems, setPlanItems] = useState<string[]>([]);
  const [planReady, setPlanReady] = useState(false);
  const [planningStep, setPlanningStep] = useState<PlanningStep>('draft');

  const issue = issues.find(item => item.id === runSetupIssueId);
  const project = projects.find(item => item.id === issue?.projectId);

  const generatedPlan = useMemo(() => {
    if (!issue) return [];
    const taskFocus = issue.subtasks.length > 0
      ? `Address ${issue.subtasks.length} defined subtask${issue.subtasks.length === 1 ? '' : 's'} and preserve the acceptance criteria.`
      : 'Translate the issue description into a focused implementation checklist.';
    return [
      `Review ${issue.identifier} and identify the smallest safe change.`,
      taskFocus,
      'Apply the change in an isolated working branch.',
      "Run the repository's configured verification commands and report their results.",
      'Prepare a concise change summary for human approval.'
    ];
  }, [issue]);

  useEffect(() => {
    if (!runSetupIssueId) return;
    const saved = runPlanDrafts[runSetupIssueId];
    setSelectedAgentId(runSetupAgentId || saved?.agentId || agents[0]?.id || '');
    setPlanItems(saved?.plan?.length ? saved.plan : generatedPlan);
    setPlanningStep('draft');
    setPlanReady(false);
    const timer = window.setTimeout(() => setPlanReady(true), 700);
    return () => window.clearTimeout(timer);
  }, [runSetupIssueId, runSetupAgentId, agents, generatedPlan]);

  if (!issue) return null;

  const repository = project?.resources?.find(resource =>
    (resource.type === 'github_repo' && Boolean(resource.localPath)) ||
    ((resource.type === 'local_path' || resource.type === 'local_dir') && Boolean(resource.pathOrUrl))
  );
  const hasWorkspace = Boolean(repository);
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId);
  const normalizedPlan = planItems.map(item => item.trim()).filter(Boolean);
  const canReview = Boolean(selectedAgent && planReady && normalizedPlan.length > 0);
  const canStart = Boolean(canReview && planningStep === 'approval' && hasWorkspace);

  const updatePlanItem = (index: number, value: string) => {
    setPlanItems(prev => prev.map((item, itemIndex) => itemIndex === index ? value : item));
  };

  const addPlanItem = () => setPlanItems(prev => [...prev, '']);

  const removePlanItem = (index: number) => {
    setPlanItems(prev => prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveDraft = () => {
    if (!selectedAgentId) {
      showToast('Choose an agent first', 'Select the agent that should own this plan.', 'error');
      return false;
    }
    if (!normalizedPlan.length) {
      showToast('Add a plan step', 'Give the agent at least one concrete step before saving.', 'error');
      return false;
    }
    saveRunPlanDraft(issue.id, selectedAgentId, normalizedPlan);
    return true;
  };

  const saveForLater = () => {
    if (!saveDraft()) return;
    showToast('Plan saved', 'The plan is saved locally and will not run until you approve it.', 'success');
    closeRunSetup();
  };

  const reviewPlan = () => {
    if (!saveDraft()) return;
    setPlanningStep('approval');
  };

  const startRun = () => {
    if (selectedAgent && canStart) {
      startPrototypeRun(issue.id, selectedAgent.id, normalizedPlan, 'success');
    }
  };

  return (
    <Modal
      isOpen={Boolean(runSetupIssueId)}
      onClose={closeRunSetup}
      title={`Prepare run for ${issue.identifier}`}
      subtitle="Draft and approve the plan before the agent can execute it."
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
                : 'No local working copy is attached to this project.'}
            </p>
          </div>
        </div>

        {(!issue.description.trim() || !hasWorkspace) && (
          <div className="flex items-start gap-3 border-y border-amber-400/15 py-3 text-xs leading-relaxed text-amber-200/80">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <p>
              {!hasWorkspace
                ? 'Attach or clone a local repository before starting. You can still save this plan for later.'
                : 'Add an issue description for a stronger plan. You can still continue with the planning step.'}
            </p>
          </div>
        )}

        <section aria-labelledby="generated-plan-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-400" />
              <h4 id="generated-plan-title" className="text-sm font-semibold text-white">
                {planningStep === 'draft' ? 'Draft execution plan' : 'Plan ready for approval'}
              </h4>
            </div>
            <span className="text-[11px] text-gray-500">
              {planningStep === 'draft' ? 'Edit before review' : 'Nothing runs until approval'}
            </span>
          </div>

          {!planReady ? (
            <div className="flex min-h-36 items-center justify-center gap-2 border-y border-white/[0.06] text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
              Preparing a focused plan…
            </div>
          ) : planningStep === 'draft' ? (
            <div className="space-y-2 border-y border-white/[0.06] py-2">
              {planItems.map((item, index) => (
                <div key={`plan-step-${index}`} className="flex items-start gap-3 border-b border-white/[0.06] py-2 last:border-b-0">
                  <span className="w-5 flex-shrink-0 pt-2 text-center text-xs tabular-nums text-gray-600">{index + 1}</span>
                  <textarea
                    aria-label={`Plan step ${index + 1}`}
                    value={item}
                    onChange={event => updatePlanItem(index, event.target.value)}
                    rows={2}
                    className="min-h-16 flex-1 resize-y border border-white/[0.08] bg-shell px-3 py-2 text-sm leading-relaxed text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-brand-400"
                    placeholder="Describe what the agent should do"
                  />
                  <button
                    type="button"
                    aria-label={`Remove plan step ${index + 1}`}
                    title="Remove step"
                    onClick={() => removePlanItem(index)}
                    disabled={planItems.length === 1}
                    className="mt-2 p-1 text-gray-500 transition-colors hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPlanItem}
                className="flex items-center gap-1.5 px-2 py-2 text-xs font-medium text-brand-300 transition-colors hover:text-brand-200"
              >
                <Plus className="h-3.5 w-3.5" />
                Add plan step
              </button>
            </div>
          ) : (
            <ol className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {normalizedPlan.map((item, index) => (
                <li key={`approved-plan-step-${index}`} className="flex gap-3 py-3 text-sm leading-relaxed text-gray-300">
                  <span className="w-5 flex-shrink-0 text-xs tabular-nums text-gray-600">{index + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {planningStep === 'approval' && (
          <p className="border-y border-brand-400/15 py-3 text-xs leading-relaxed text-brand-100/80">
            This plan is saved locally for this issue. Approving starts the real agent run on the attached workspace;
            closing this dialog leaves the saved plan untouched.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={closeRunSetup}
            className="px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          {planningStep === 'approval' && (
            <button
              type="button"
              onClick={() => setPlanningStep('draft')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to edit
            </button>
          )}
          <button
            type="button"
            disabled={!canReview}
            onClick={saveForLater}
            className="flex items-center gap-1.5 border border-white/[0.1] px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Save plan for later
          </button>
          {planningStep === 'draft' ? (
            <button
              type="button"
              disabled={!canReview}
              onClick={reviewPlan}
              className="flex items-center gap-2 bg-brand-500 px-4 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              Review plan
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStart}
              onClick={startRun}
              className="flex items-center gap-2 bg-brand-500 px-4 py-2 text-xs font-medium text-on-accent transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              title={!hasWorkspace ? 'Attach or clone a repository before starting' : undefined}
            >
              <Check className="h-4 w-4" />
              Approve and start
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
