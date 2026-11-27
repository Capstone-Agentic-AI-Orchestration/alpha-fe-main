import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { nextActionLine, revisionAllowance, stageSteps, type StageSummary } from './projectStages';
import './projectStages.css';

/**
 * The stage strip both sides see under a project conversation's header:
 * Proof of concept → Development → Completed, the revision allowance, and whose
 * turn it is. A slim row, not a card.
 */
export function ProjectStageTracker({ summary, role, unsetPrompt = true, nextActionControl }: Readonly<{
  summary: StageSummary; role: 'client' | 'pm';
  /** Whether the row says the stage isn't set; the PM's side panel says it instead, beside the stage picker. */
  unsetPrompt?: boolean;
  /** Overrides the next-action text. Pass null to hide it. */
  nextActionControl?: ReactNode;
}>) {
  const steps = stageSteps(summary.stage);
  const allowance = revisionAllowance(summary);
  const next = nextActionLine(summary, role);
  const unset = summary.stage === 'unset';
  return <section className="ps-tracker" aria-label="Project stage">
    <ol className="ps-steps">
      {steps.map((step, index) => <li key={step.stage} className={'ps-step is-' + step.state} aria-current={step.state === 'current' ? 'step' : undefined}>
        <span className="ps-step-dot" aria-hidden="true">{step.state === 'done' ? <Check size={12} strokeWidth={3} /> : index + 1}</span>
        <span className="ps-step-label">{step.label}</span>
        <span className="sr-only">{step.state === 'done' ? ' (done)' : step.state === 'current' ? ' (current stage)' : ''}</span>
      </li>)}
    </ol>
    <div className="ps-meta">
      {unset && unsetPrompt && <span>{role === 'pm' ? 'This project started before stages. Choose where it is now.' : 'Stage not set yet'}</span>}
      {allowance && <span className="ps-allowance">{allowance}</span>}
      {nextActionControl === undefined
        ? next && !(unset && role === 'pm') && <span className={next.mine ? 'ps-next is-mine' : 'ps-next'}>{next.mine ? 'Your turn: ' : ''}{next.text}</span>
        : nextActionControl}
    </div>
  </section>;
}
