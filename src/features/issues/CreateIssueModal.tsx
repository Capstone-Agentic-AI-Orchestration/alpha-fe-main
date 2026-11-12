import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import type { IssuePriority, IssueStatus, SystemProposal } from '@/shared/types';
import { apiService } from '@/shared/services/apiService';
import { isDesktop } from '@/shared/desktop';
import { Modal } from '@/shared/components/Modal';
import { TASK_PRIORITIES, TASK_STATUSES } from './taskFlow';
import { DatePicker } from '@/shared/components/ui/date-picker';

interface CreateIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional context supplied by a project execution view. */
  initialProjectId?: string;
  /** Free text to start from: its first line becomes the title, the rest the description. */
  initialPrompt?: string;
  initialTitle?: string;
  initialDescription?: string;
}

interface DraftSubtask {
  key: string;
  title: string;
  keep: boolean;
}

const AVAILABLE_LABELS = ['frontend', 'backend', 'UI/UX', 'bug', 'feature', 'performance', 'core', 'runtime'];
const MAX_STEP_SUGGESTION_CHARS = 4_000;
const fieldClass = 'h-9 w-full rounded-md border border-control bg-well px-2.5 text-[13px] text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** A short form first; optional task setup stays behind More options. */
export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  isOpen,
  onClose,
  initialProjectId,
  initialPrompt,
  initialTitle,
  initialDescription
}) => {
  const { createIssue, projects, identity, can } = useApp();
  const ids = useId();
  const canRunBuilds = can('run_builds');
  const canSuggestSteps = isDesktop && canRunBuilds && can('manage_chat');

  const [title, setTitle] = useTabSessionState<string>('issueModal.title', initialTitle ?? '');
  const [description, setDescription] = useTabSessionState<string>('issueModal.description', initialDescription ?? '');
  const [selectedProjectId, setSelectedProjectId] = useTabSessionState<string>('issueModal.project', initialProjectId || projects[0]?.id || '');
  const [dueDate, setDueDate] = useTabSessionState<string>('issueModal.dueDate', '');
  const [status, setStatus] = useTabSessionState<IssueStatus>('issueModal.status', 'todo');
  const [priority, setPriority] = useTabSessionState<IssuePriority>('issueModal.priority', 'medium');
  const [assignee, setAssignee] = useTabSessionState<string>('issueModal.assignee', '');
  const [labels, setLabels] = useTabSessionState<string[]>('issueModal.labels', []);
  const [subtasks, setSubtasks] = useTabSessionState<DraftSubtask[]>('issueModal.subtasks', []);
  const [newSubtask, setNewSubtask] = useTabSessionState<string>('issueModal.newSubtask', '');
  const [suggestingSteps, setSuggestingSteps] = useState(false);
  const [stepSuggestionError, setStepSuggestionError] = useState('');
  const [stepProposal, setStepProposal] = useState<SystemProposal | null>(null);
  const [selectedSteps, setSelectedSteps] = useState<Set<number>>(new Set());
  const suggestionRequest = useRef(0);

  // The modal can mount before the daemon hydrates projects; move to a real
  // project before submit so creation cannot hit a foreign-key error.
  useEffect(() => {
    if (projects.length > 0 && !projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialProjectId) setSelectedProjectId(initialProjectId);
    if (initialPrompt !== undefined) {
      const [firstLine = '', ...rest] = initialPrompt.trim().split('\n');
      setTitle(firstLine.slice(0, 120));
      setDescription(rest.join('\n').trim() || initialPrompt.trim());
    }
    if (initialTitle !== undefined) setTitle(initialTitle);
    if (initialDescription !== undefined) setDescription(initialDescription);
  }, [initialDescription, initialProjectId, initialPrompt, initialTitle, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    suggestionRequest.current += 1;
    setSuggestingSteps(false);
    setStepSuggestionError('');
    setStepProposal(null);
    setSelectedSteps(new Set());
  }, [isOpen]);

  if (!isOpen) return null;

  const activeProject = projects.find(project => project.id === selectedProjectId) || projects[0];
  const showProjectSelect = !initialProjectId && projects.length > 1;
  const kept = subtasks.filter(subtask => subtask.keep);
  // Building is entered only by the explicit Orchestrator run command. A
  // stale tab-session value must not let an old draft create a task in it.
  const safeStatus: IssueStatus = status === 'agent_running' ? 'todo' : status;
  const canSubmit = Boolean(title.trim() && activeProject);
  const submitHint = !activeProject
    ? 'Create a project before creating a task.'
    : !title.trim()
      ? 'Enter a task name first.'
      : 'Create task (Ctrl or Cmd + Enter)';

  const reset = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setStatus('todo');
    setPriority('medium');
    setSubtasks([]);
    setNewSubtask('');
    setLabels([]);
    setAssignee('');
    setStepProposal(null);
    setSelectedSteps(new Set());
    setStepSuggestionError('');
  };

  const suggestSteps = async () => {
    if (!activeProject || !title.trim() || suggestingSteps) return;
    const requestId = ++suggestionRequest.current;
    setSuggestingSteps(true);
    setStepSuggestionError('');
    setStepProposal(null);
    const request = [
      `Parent task: ${title.trim()}`,
      description.trim() ? `Description: ${description.trim()}` : 'No additional description was provided.',
      'Break this task into a short, ordered set of child tasks that together complete the parent. Stay within the parent task scope.'
    ].join('\n\n');
    try {
      if (request.length > MAX_STEP_SUGGESTION_CHARS) {
        throw new Error('Shorten the task description before asking Alpha to suggest steps.');
      }
      const proposal = await apiService.proposeSystemEpics(activeProject.id, request);
      if (requestId !== suggestionRequest.current) return;
      setStepProposal(proposal);
      setSelectedSteps(new Set(proposal.epics.map((_epic, index) => index)));
    } catch (error) {
      if (requestId === suggestionRequest.current) {
        setStepSuggestionError(error instanceof Error ? error.message : 'Alpha could not suggest steps. Try again.');
      }
    } finally {
      if (requestId === suggestionRequest.current) setSuggestingSteps(false);
    }
  };

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    setSubtasks(prev => [...prev, { key: `m-${Date.now()}`, title: text, keep: true }]);
    setNewSubtask('');
  };

  const toggleLabel = (label: string) =>
    setLabels(prev => (prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]));

  const handleSubmit = () => {
    if (!canSubmit || !activeProject || suggestingSteps) return;
    const stepsToCreate = stepProposal?.epics.filter((_epic, index) => selectedSteps.has(index)) ?? [];
    const created = createIssue(
      {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
        projectId: activeProject.id,
        priority,
        status: safeStatus,
        labels,
        assignedHuman: assignee || undefined,
        subtasks: kept.map(subtask => subtask.title)
      },
      stepsToCreate.length > 0
        ? {
            onSaved: savedParent => {
              stepsToCreate.forEach(step => {
                createIssue({
                  title: step.title,
                  description: step.outcome + (step.personas.length ? `\n\nFor: ${step.personas.join(', ')}` : ''),
                  projectId: savedParent.projectId,
                  parentIssueId: savedParent.id,
                  priority: savedParent.priority,
                  status: 'backlog',
                  labels: savedParent.labels,
                  assignedHuman: savedParent.assignedHuman
                });
              });
            }
          }
        : undefined
    );
    if (!created) return;
    reset();
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {!canSubmit && <p id={`${ids}-submit-hint`} className="text-xs text-content-muted" role="status">{submitHint}</p>}
      <div className="ml-auto flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className="h-9 rounded-md border border-divider px-3 text-[13px] font-medium text-content-secondary hover:bg-surface-high hover:text-content">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || suggestingSteps}
          title={submitHint}
          aria-describedby={!canSubmit ? `${ids}-submit-hint` : undefined}
          className="inline-flex h-9 items-center rounded-md bg-action px-3.5 text-[13px] font-semibold text-on-action hover:bg-action-hover disabled:cursor-default disabled:opacity-40"
        >
          Create task
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New task"
      subtitle={activeProject ? `In ${activeProject.name}` : 'Create a project first'}
      maxWidth="max-w-xl"
      footer={footer}
    >
      <div className="space-y-5" onKeyDown={onKeyDown}>
        <div className="space-y-4">
          <label htmlFor={`${ids}-title`} className="block">
            <span className="mb-2 block text-[12px] font-medium text-content-secondary">Task name</span>
            <input
              id={`${ids}-title`}
              aria-label="Task title"
              autoFocus
              value={title}
              disabled={suggestingSteps}
          onChange={event => { setTitle(event.target.value); setStepProposal(null); setSelectedSteps(new Set()); setStepSuggestionError(''); }}
              placeholder="What needs to happen?"
              required
              aria-required="true"
              aria-invalid={!title.trim()}
              className="w-full border-b border-control bg-transparent pb-2 text-xl font-semibold tracking-tight text-content placeholder-content-muted focus:border-link focus:outline-none"
            />
          </label>

          <label htmlFor={`${ids}-description`} className="block">
            <span className="mb-2 block text-[12px] font-medium text-content-secondary">What should be true when this is finished? <span className="font-normal text-content-muted">Optional</span></span>
            <textarea
              id={`${ids}-description`}
              aria-label="Description"
              rows={3}
              value={description}
              disabled={suggestingSteps}
              onChange={event => { setDescription(event.target.value); setStepProposal(null); setSelectedSteps(new Set()); setStepSuggestionError(''); }}
              placeholder="Describe the result in a sentence or two."
              className="w-full resize-y rounded-md border border-control bg-well px-3 py-2.5 text-[13px] leading-relaxed text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {showProjectSelect && (
            <label className="min-w-0 flex-1 space-y-1.5">
              <span className="block text-[11.5px] font-medium text-content-secondary">Project</span>
              <select value={activeProject?.id ?? ''} disabled={suggestingSteps} onChange={event => { setSelectedProjectId(event.target.value); setStepProposal(null); setSelectedSteps(new Set()); setStepSuggestionError(''); }} className={fieldClass}>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
          )}
          <label className="space-y-1.5 sm:w-48">
            <span className="block text-[11.5px] font-medium text-content-secondary">Due date <span className="font-normal text-content-muted">Optional</span></span>
            <DatePicker
              value={dueDate}
              onChange={setDueDate}
              buttonClassName={`${fieldClass} h-9 text-xs`}
              className="w-full"
              aria-label="Task due date"
            />
          </label>
        </div>

        {canSuggestSteps && (
          <section className="space-y-2 rounded-md border border-divider p-3" aria-label="Optional task breakdown">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void suggestSteps()}
                disabled={!title.trim() || !activeProject || suggestingSteps}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-divider px-2.5 text-[12px] font-medium text-content-secondary hover:bg-surface-high hover:text-content disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-link" />
                {suggestingSteps ? 'Thinking…' : stepProposal ? 'Suggest again' : 'Suggest steps with Alpha'}
              </button>
              {!stepProposal && <span className="text-[11.5px] text-content-muted">Optional</span>}
            </div>
            {stepSuggestionError && <p role="alert" className="text-xs text-status-danger">{stepSuggestionError}</p>}
            {suggestingSteps && <p role="status" className="text-xs text-content-muted">Alpha is drafting steps for you to review.</p>}
            {stepProposal && (
              <div className="space-y-2">
                <p className="text-[11.5px] text-content-secondary">Choose the steps to create as linked tasks. They will wait in Backlog until someone moves them forward.</p>
                <ul className="space-y-1.5">
                  {stepProposal.epics.map((step, index) => (
                    <li key={`${step.title}-${index}`}>
                      <label className="flex cursor-pointer gap-2.5 rounded-md border border-divider p-2.5 hover:bg-surface-high">
                        <input
                          type="checkbox"
                          checked={selectedSteps.has(index)}
                          onChange={() => setSelectedSteps(current => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index); else next.add(index);
                            return next;
                          })}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500"
                        />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-medium text-content">{step.title}</span>
                          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-content-secondary">{step.outcome}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <details className="group border-t border-divider pt-3">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[12px] font-medium text-content-secondary [&::-webkit-details-marker]:hidden">
            More options
            <ChevronDown aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="block text-[11.5px] text-content-muted">Status</span>
                <select value={safeStatus} onChange={event => setStatus(event.target.value as IssueStatus)} className={fieldClass}>
                  {TASK_STATUSES.filter(item => item.id !== 'agent_running').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[11.5px] text-content-muted">Priority</span>
                <select value={priority} onChange={event => setPriority(event.target.value as IssuePriority)} className={fieldClass}>
                  {TASK_PRIORITIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[11.5px] text-content-muted">Assignee</span>
                <select value={assignee} onChange={event => setAssignee(event.target.value)} className={fieldClass}>
                  <option value="">Unassigned</option>
                  {identity && <option value={identity.login}>Me ({identity.login})</option>}
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-[11.5px] text-content-muted">Labels</legend>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_LABELS.map(label => {
                  const on = labels.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleLabel(label)}
                      className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${on ? 'border-divider bg-selected text-selected-content' : 'border-divider text-content-secondary hover:bg-surface-high hover:text-content'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <section aria-labelledby={`${ids}-subtasks`} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 id={`${ids}-subtasks`} className="text-[12px] font-semibold text-content-secondary">Checklist items</h4>
                {subtasks.length > 0 && <span className="text-xs tabular-nums text-content-muted">{kept.length} of {subtasks.length} kept</span>}
              </div>
              {subtasks.length > 0 && (
                <ul className="space-y-0.5">
                  {subtasks.map(subtask => (
                    <li key={subtask.key} className="flex min-h-8 items-center gap-2.5 rounded-md px-2 hover:bg-surface-high">
                      <input
                        id={`${ids}-${subtask.key}`}
                        type="checkbox"
                        checked={subtask.keep}
                        onChange={() => setSubtasks(prev => prev.map(item => (item.key === subtask.key ? { ...item, keep: !item.keep } : item)))}
                        className="h-3.5 w-3.5 accent-brand-500"
                      />
                      <label htmlFor={`${ids}-${subtask.key}`} className={`flex-1 cursor-pointer text-[13px] ${subtask.keep ? 'text-content' : 'text-content-muted line-through'}`}>
                        {subtask.title}
                      </label>
                      <button type="button" aria-label={`Remove ${subtask.title}`} onClick={() => setSubtasks(prev => prev.filter(item => item.key !== subtask.key))} className="rounded p-1 text-content-muted hover:text-content">
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex h-9 items-center gap-2 rounded-md border border-dashed border-divider px-2.5">
                <Plus aria-hidden="true" className="h-3.5 w-3.5 text-content-muted" />
                <label htmlFor={`${ids}-new-subtask`} className="sr-only">New checklist item</label>
                <input
                  id={`${ids}-new-subtask`}
                  value={newSubtask}
                  onChange={event => setNewSubtask(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      addSubtask();
                    }
                  }}
                  placeholder="Add a checklist item"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-content placeholder-content-muted focus:outline-none"
                />
                <button type="button" onClick={addSubtask} disabled={!newSubtask.trim()} className="text-xs font-semibold text-link disabled:opacity-40">
                  Add
                </button>
              </div>
            </section>
          </div>
        </details>
      </div>
    </Modal>
  );
};
