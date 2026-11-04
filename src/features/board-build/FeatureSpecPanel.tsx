import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import type { FeatureSpec, Issue } from '@/shared/types';
import type { useFeatureSpec } from './useTaskBuild';

type SpecApi = ReturnType<typeof useFeatureSpec>;

interface FeatureSpecPanelProps {
  issue: Issue;
  spec: SpecApi;
  /** Draft automatically once, for a card created from "New feature". */
  autoDraft?: boolean;
  onAutoDrafted?: () => void;
}

const button = 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold disabled:opacity-40';
const primary = `${button} bg-action text-on-action hover:bg-action-hover`;
const secondary = `${button} border border-divider font-medium text-content-secondary hover:bg-surface-high hover:text-content`;
const field = 'w-full resize-y rounded-md border border-control bg-well px-3 py-2 text-[13px] text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);

/**
 * The task's feature spec: who it is for, how they will use it, and the
 * checklist that says when it is done.
 *
 * The Manager Agent drafts it; a person edits, answers open questions, and
 * approves it. Approval puts one checklist item per requirement on the card
 * and fixes the requirements the build plans against.
 */
export const FeatureSpecPanel: React.FC<FeatureSpecPanelProps> = ({ issue, spec, autoDraft, onAutoDrafted }) => {
  const { can, applySavedIssue } = useApp();
  const canDraft = can('run_builds') && can('manage_chat');
  const canEdit = can('manage_issues');
  const record = spec.record;
  const [editing, setEditing] = useState<FeatureSpec | null>(null);
  const [revision, setRevision] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!autoDraft || !spec.loaded || record || spec.busy || !canDraft) return;
    onAutoDrafted?.();
    void spec.draft(`${issue.title}\n\n${issue.description ?? ''}`.trim());
  }, [autoDraft, canDraft, issue.description, issue.title, onAutoDrafted, record, spec]);

  useEffect(() => { setEditing(null); setAnswers({}); }, [record?.version]);

  const working = spec.busy === 'draft' || spec.busy === 'revise';
  const status = !record ? null : record.status === 'approved' ? (record.stale ? 'Out of date' : 'Approved') : 'Draft';

  /** Fold an answered question into the summary, so the decision stays in the spec. */
  const answerQuestion = (index: number) => {
    if (!record) return;
    const answer = answers[index]?.trim();
    const question = record.spec.openQuestions[index];
    const next: FeatureSpec = {
      ...record.spec,
      summary: answer ? `${record.spec.summary}\nDecided: ${question} ${answer}`.slice(0, 2000) : record.spec.summary,
      openQuestions: record.spec.openQuestions.filter((_item, position) => position !== index)
    };
    void spec.save(next);
  };

  return (
    <section aria-labelledby={`spec-${issue.id}`} className="space-y-3 rounded-lg border border-divider p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <FileText aria-hidden="true" className="h-4 w-4 text-content-muted" />
        <h3 id={`spec-${issue.id}`} className="text-[13px] font-semibold text-content-secondary">Feature spec</h3>
        {status && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status === 'Approved' ? 'bg-status-success-subtle text-status-success' : status === 'Out of date' ? 'bg-status-warning-subtle text-status-warning' : 'bg-surface-high text-content-secondary'}`}>{status}</span>
        )}
        {record && canEdit && !editing && (
          <span className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setEditing(record.spec)} aria-label="Edit the spec" title="Edit" className="rounded-md p-1.5 text-content-muted hover:bg-surface-high hover:text-content"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => void spec.remove()} aria-label="Remove the spec" title="Remove" className="rounded-md p-1.5 text-content-muted hover:bg-status-danger-subtle hover:text-status-danger"><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        )}
      </div>

      {spec.error && <p role="alert" className="text-[12.5px] text-status-danger">{spec.error}</p>}
      {working && <p role="status" className="text-[12.5px] text-content-muted">Drafting requirements and user journeys for your review.</p>}

      {!record && !working && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-content-muted">Who is this for, how will they use it, and how will we know it is done? A spec answers that, and the build follows its checklist.</p>
          {canDraft && (
            <button type="button" disabled={!spec.loaded || Boolean(spec.busy)} onClick={() => void spec.draft(`${issue.title}\n\n${issue.description ?? ''}`.trim())} className={secondary}>
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-link" /> Write a spec
            </button>
          )}
        </div>
      )}

      {record?.stale && <p className="text-[12.5px] text-status-warning">The task changed after this spec was approved. Check it still fits, then approve it again before the next build.</p>}

      {record && !editing && (
        <div className="space-y-3 text-[13px]">
          <p className="whitespace-pre-wrap text-content-secondary">{record.spec.summary}</p>
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-content-muted">Who it is for</h4>
            <ul className="mt-1 space-y-0.5 text-content-secondary">
              {record.spec.personas.map(persona => <li key={persona.id}>As a <span className="font-medium text-content">{persona.name.toLowerCase()}</span>, {persona.goal.charAt(0).toLowerCase() + persona.goal.slice(1)}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-content-muted">User journeys</h4>
            <ul className="mt-1 space-y-1.5">
              {record.spec.journeys.map(journey => (
                <li key={journey.id}>
                  <span className="font-medium text-content">{journey.title}</span>
                  <span className="block text-[12.5px] text-content-muted">{journey.steps.join(' → ')}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wide text-content-muted">Checklist</h4>
            <ul className="mt-1 space-y-1.5">
              {record.spec.requirements.map(requirement => (
                <li key={requirement.id}>
                  <span className="text-content"><span className="font-mono text-[11.5px] text-content-muted">{requirement.id}</span> {requirement.behavior}</span>
                  <ul className="ml-4 list-disc text-[12.5px] text-content-muted">
                    {requirement.acceptanceCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
          {record.spec.exclusions.length > 0 && <p className="text-[12.5px] text-content-muted">Out of scope: {record.spec.exclusions.join('; ')}</p>}

          {record.spec.openQuestions.length > 0 && (
            <div className="space-y-2 rounded-md border border-status-warning-border bg-status-warning-subtle p-3">
              <h4 className="text-[12.5px] font-semibold text-status-warning">Answer these before approving</h4>
              {record.spec.openQuestions.map((question, index) => (
                <div key={question} className="space-y-1.5">
                  <p className="text-[12.5px] text-content">{question}</p>
                  {canEdit && (
                    <div className="flex gap-2">
                      <label htmlFor={`answer-${issue.id}-${index}`} className="sr-only">Answer</label>
                      <input id={`answer-${issue.id}-${index}`} value={answers[index] ?? ''} onChange={event => setAnswers(current => ({ ...current, [index]: event.target.value }))} placeholder="Your answer" className="h-8 min-w-0 flex-1 rounded-md border border-control bg-well px-2.5 text-[12.5px] text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
                      <button type="button" disabled={Boolean(spec.busy)} onClick={() => answerQuestion(index)} className={secondary}>{answers[index]?.trim() ? 'Save answer' : 'Remove'}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (record.status !== 'approved' || record.stale) && (
              <button
                type="button"
                disabled={Boolean(spec.busy) || record.spec.openQuestions.length > 0}
                onClick={() => void spec.approve().then(saved => { if (saved) applySavedIssue(saved); })}
                className={primary}
              >
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Approve spec
              </button>
            )}
          </div>

          {canDraft && (
            <form
              className="flex items-end gap-2"
              onSubmit={event => {
                event.preventDefault();
                void spec.revise(revision).then(saved => { if (saved) setRevision(''); });
              }}
            >
              <label htmlFor={`revise-${issue.id}`} className="sr-only">Ask for changes to the spec</label>
              <input id={`revise-${issue.id}`} value={revision} maxLength={2000} onChange={event => setRevision(event.target.value)} placeholder="Ask for changes, for example: add an admin journey" className="h-8 min-w-0 flex-1 rounded-md border border-control bg-well px-2.5 text-[12.5px] text-content placeholder-content-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
              <button type="submit" disabled={!revision.trim() || Boolean(spec.busy)} className={secondary}>Revise</button>
            </form>
          )}
        </div>
      )}

      {record && editing && (
        <form
          className="space-y-3"
          onSubmit={event => {
            event.preventDefault();
            void spec.save(editing);
          }}
        >
          <label className="block space-y-1 text-[12px] font-medium text-content-muted">
            Summary
            <textarea rows={3} value={editing.summary} onChange={event => setEditing({ ...editing, summary: event.target.value })} className={field} />
          </label>
          {editing.requirements.map((requirement, index) => (
            <fieldset key={requirement.id} className="space-y-1.5 rounded-md border border-divider p-2.5">
              <legend className="px-1 font-mono text-[11.5px] text-content-muted">{requirement.id}</legend>
              <label className="block space-y-1 text-[12px] font-medium text-content-muted">
                Behavior
                <textarea rows={2} value={requirement.behavior} onChange={event => setEditing({ ...editing, requirements: editing.requirements.map((item, position) => position === index ? { ...item, behavior: event.target.value } : item) })} className={field} />
              </label>
              <label className="block space-y-1 text-[12px] font-medium text-content-muted">
                Acceptance criteria, one per line
                <textarea rows={3} value={requirement.acceptanceCriteria.join('\n')} onChange={event => setEditing({ ...editing, requirements: editing.requirements.map((item, position) => position === index ? { ...item, acceptanceCriteria: lines(event.target.value) } : item) })} className={field} />
              </label>
            </fieldset>
          ))}
          <label className="block space-y-1 text-[12px] font-medium text-content-muted">
            Out of scope, one per line
            <textarea rows={2} value={editing.exclusions.join('\n')} onChange={event => setEditing({ ...editing, exclusions: lines(event.target.value) })} className={field} />
          </label>
          <label className="block space-y-1 text-[12px] font-medium text-content-muted">
            Open questions, one per line
            <textarea rows={2} value={editing.openQuestions.join('\n')} onChange={event => setEditing({ ...editing, openQuestions: lines(event.target.value) })} className={field} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={Boolean(spec.busy)} className={primary}>Save spec</button>
            <button type="button" onClick={() => setEditing(null)} className={secondary}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
};
