import React, { useEffect, useId } from 'react';
import { Plus, Sparkles, X } from 'lucide-react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { IssuePriority, IssueStatus } from '@/shared/types';
import { Modal } from '@/shared/components/Modal';
import { TASK_PRIORITIES, TASK_STATUSES, suggestSubtasks } from './taskFlow';

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
  suggested: boolean;
}

const AVAILABLE_LABELS = ['frontend', 'backend', 'UI/UX', 'bug', 'feature', 'performance', 'core', 'runtime'];

const fieldClass = 'h-8 w-full rounded-md border border-control bg-well px-2 text-[13px] text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/**
 * One form for a new task.
 *
 * It used to have two modes. "Create with agent" took a prompt, cut the first
 * line down to a title and added three fixed subtasks to every task, whatever it
 * was about; "Create manually" was the honest form behind a toggle. Now there is
 * the honest form, subtasks suggested only from what the author wrote and shown
 * as suggestions they keep or drop, and an explicit choice to plan a build.
 */
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

  const [title, setTitle] = useTabSessionState<string>('issueModal.title', initialTitle ?? '');
  const [description, setDescription] = useTabSessionState<string>('issueModal.description', initialDescription ?? '');
  const [selectedProjectId, setSelectedProjectId] = useTabSessionState<string>('issueModal.project', initialProjectId || projects[0]?.id || '');
  const [status, setStatus] = useTabSessionState<IssueStatus>('issueModal.status', 'todo');
  const [priority, setPriority] = useTabSessionState<IssuePriority>('issueModal.priority', 'medium');
  const [assignee, setAssignee] = useTabSessionState<string>('issueModal.assignee', '');
  const [labels, setLabels] = useTabSessionState<string[]>('issueModal.labels', []);
  const [subtasks, setSubtasks] = useTabSessionState<DraftSubtask[]>('issueModal.subtasks', []);
  const [newSubtask, setNewSubtask] = useTabSessionState<string>('issueModal.newSubtask', '');
  const [planBuild, setPlanBuild] = useTabSessionState<boolean>('issueModal.planBuild', false);
  const [noSuggestions, setNoSuggestions] = useTabSessionState<boolean>('issueModal.noSuggestions', false);

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

  if (!isOpen) return null;

  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const kept = subtasks.filter(subtask => subtask.keep);
  const hasSuggestions = subtasks.some(subtask => subtask.suggested);
  // Building is entered only by the explicit Orchestrator run command. A
  // stale tab-session value must not let an old draft create a task in it.
  const safeStatus: IssueStatus = status === 'agent_running' ? 'todo' : status;
  const canSubmit = Boolean(title.trim() && activeProject);
  const submitHint = !activeProject
    ? 'Create a project before creating a task.'
    : !title.trim()
      ? 'Enter a task title first.'
      : 'Create task (Ctrl or Cmd + Enter)';

  const reset = () => {
    setTitle('');
    setDescription('');
    setSubtasks([]);
    setNewSubtask('');
    setLabels([]);
    setAssignee('');
    setPlanBuild(false);
    setNoSuggestions(false);
  };

  const suggest = () => {
    const suggestions = suggestSubtasks(description);
    setNoSuggestions(suggestions.length === 0);
    setSubtasks(prev => [
      ...prev.filter(subtask => !subtask.suggested),
      ...suggestions.map((text, index) => ({ key: `s-${Date.now()}-${index}`, title: text, keep: true, suggested: true }))
    ]);
  };

  const addSubtask = () => {
    const text = newSubtask.trim();
    if (!text) return;
    setSubtasks(prev => [...prev, { key: `m-${Date.now()}`, title: text, keep: true, suggested: false }]);
    setNewSubtask('');
  };

  const toggleLabel = (label: string) =>
    setLabels(prev => (prev.includes(label) ? prev.filter(item => item !== label) : [...prev, label]));

  const handleSubmit = () => {
    if (!canSubmit || !activeProject) return;
    const created = createIssue(
      {
        title: title.trim(),
        description: description.trim(),
        projectId: activeProject.id,
        priority,
        status: safeStatus,
        labels,
        assignedHuman: assignee || undefined,
        subtasks: kept.map(subtask => subtask.title)
      },
      { planBuild: planBuild && canRunBuilds && safeStatus !== 'done' }
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
        <button type="button" onClick={onClose} className="h-8 rounded-md border border-divider px-3 text-[13px] font-medium text-content-secondary hover:bg-surface-high hover:text-content">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          title={submitHint}
          aria-describedby={!canSubmit ? `${ids}-submit-hint` : undefined}
          className="inline-flex h-8 items-center gap-2.5 rounded-md bg-action px-3 text-[13px] font-semibold text-on-action hover:bg-action-hover disabled:cursor-default disabled:opacity-40"
        >
          Create task
          <kbd className="font-mono text-[10.5px] font-medium opacity-70">Ctrl ↵</kbd>
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
      maxWidth="max-w-2xl"
      footer={footer}
    >
      <div className="space-y-5" onKeyDown={onKeyDown}>
        <div className="space-y-2">
          <label htmlFor={`${ids}-title`} className="block text-[12px] font-medium text-content-secondary">
            Task title <span className="text-content-muted">(required)</span>
          </label>
          <input
            id={`${ids}-title`}
            autoFocus
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="What needs to happen?"
            required
            aria-required="true"
            aria-invalid={!title.trim()}
            className="w-full bg-transparent py-1 text-xl font-semibold tracking-tight text-content placeholder-content-muted focus:outline-none"
          />
          <label htmlFor={`${ids}-description`} className="block pt-1 text-[12px] font-medium text-content-secondary">
            Description <span className="font-normal text-content-muted">(optional, but helps with planning)</span>
          </label>
          <textarea
            id={`${ids}-description`}
            rows={4}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Describe the outcome. Add links, error messages or what done looks like."
            className="w-full resize-y rounded-md border border-control bg-well px-3 py-2.5 text-sm leading-relaxed text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1">
            <span className="block text-[11.25px] text-content-muted">Project</span>
            <select value={activeProject?.id ?? ''} onChange={event => setSelectedProjectId(event.target.value)} className={fieldClass}>
              {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11.25px] text-content-muted">Status</span>
            <select value={safeStatus} onChange={event => setStatus(event.target.value as IssueStatus)} className={fieldClass}>
              {/* Building is a real Orchestrator build, chosen below, not a status to type in. */}
              {TASK_STATUSES.filter(item => item.id !== 'agent_running').map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11.25px] text-content-muted">Priority</span>
            <select value={priority} onChange={event => setPriority(event.target.value as IssuePriority)} className={fieldClass}>
              {TASK_PRIORITIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-[11.25px] text-content-muted">Assignee</span>
            <select value={assignee} onChange={event => setAssignee(event.target.value)} className={fieldClass}>
              <option value="">Unassigned</option>
              {identity && <option value={identity.login}>Me ({identity.login})</option>}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[11.25px] text-content-muted">Labels</legend>
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
            <h4 id={`${ids}-subtasks`} className="text-[13px] font-semibold text-content-secondary">Subtasks</h4>
            {subtasks.length > 0 && <span className="text-xs tabular-nums text-content-muted">{kept.length} of {subtasks.length} kept</span>}
            <button
              type="button"
              onClick={suggest}
              disabled={!description.trim()}
              title={description.trim() ? 'Suggest subtasks from the description' : 'Write a description first'}
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-divider px-2.5 text-xs font-medium text-content-secondary hover:bg-surface-high hover:text-content disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5 text-link" />
              {hasSuggestions ? 'Suggest again' : 'Suggest from description'}
            </button>
          </div>
          {hasSuggestions && <p className="text-xs text-content-muted">Suggested from your description. Untick any you don’t want.</p>}
          {noSuggestions && <p className="text-xs text-content-muted">Nothing to suggest yet. Describe the work in a few sentences or as a list.</p>}
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
                  {subtask.suggested && <span className="font-mono text-[10px] uppercase tracking-wider text-link">Suggested</span>}
                  {!subtask.suggested && (
                    <button type="button" aria-label={`Remove ${subtask.title}`} onClick={() => setSubtasks(prev => prev.filter(item => item.key !== subtask.key))} className="rounded p-1 text-content-muted hover:text-content">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex h-8 items-center gap-2 rounded-md border border-dashed border-divider px-2.5">
            <Plus className="h-3.5 w-3.5 text-content-muted" />
            <label htmlFor={`${ids}-new-subtask`} className="sr-only">New subtask</label>
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
              placeholder="Add a subtask"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-content placeholder-content-muted focus:outline-none"
            />
            <button type="button" onClick={addSubtask} disabled={!newSubtask.trim()} className="text-xs font-semibold text-link disabled:opacity-40">
              Add
            </button>
          </div>
        </section>

        {canRunBuilds && (
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-divider p-3">
            <input
              type="checkbox"
              checked={planBuild}
              onChange={event => setPlanBuild(event.target.checked)}
              disabled={safeStatus === 'done'}
              className="mt-0.5 h-3.5 w-3.5 accent-brand-500"
            />
            <span>
              <span className="block text-[13px] font-medium text-content">Plan a build when it’s created</span>
              <span className="mt-0.5 block text-xs text-content-muted">
                The Orchestrator drafts a plan in the project chat for you to approve. Nothing in the code changes until you approve it.
              </span>
            </span>
          </label>
        )}
        {!canRunBuilds && (
          <p className="rounded-md border border-divider bg-surface-high px-3 py-2 text-xs text-content-muted">
            Build planning is available to developers and admins. After creating this task, you can review the resulting work here.
          </p>
        )}
      </div>
    </Modal>
  );
};
