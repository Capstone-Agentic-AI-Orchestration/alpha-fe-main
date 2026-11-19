import type { ClientProgressStep } from './clientProgressSteps';
import { Check, ClipboardCheck, Flag, Hammer, Inbox, Sparkles } from 'lucide-react';

const stateText = { done: 'done', current: 'current step', upcoming: 'not started' } as const;
const visibleStateText = { done: 'Complete', current: 'Now', upcoming: 'Not started' } as const;
/** One picture per step: received, the plan, the work, the result, done. */
const STEP_ICONS = [Inbox, ClipboardCheck, Hammer, Sparkles, Flag];

/** The request's five steps as tiles, with the current one highlighted and the client's turn called out. */
export function ClientProgressStrip({ steps }: { steps: ClientProgressStep[] }) {
  if (steps.length === 0) return null;
  const index = steps.findIndex(step => step.state === 'current');
  const current = steps[index];
  return <div className="cx-journey-wrap">
    <ol aria-label="Request progress" className="cx-journey">
      {steps.map((step, stepIndex) => {
        const Icon = step.state === 'done' ? Check : STEP_ICONS[stepIndex] ?? Flag;
        return <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className={'cx-jstep is-' + step.state + (step.needsYou ? ' is-action' : '')}>
          <span className="cx-jstep-icon" aria-hidden="true"><Icon size={18} /></span>
          <span className="sr-only">{step.label}{step.needsYou ? ', your turn' : ''} ({stateText[step.state]})</span>
          <span aria-hidden="true" className="cx-jstep-label">{step.label}</span>
          <span aria-hidden="true" className="cx-jstep-state">{step.needsYou ? 'Your turn' : visibleStateText[step.state]}</span>
        </li>;
      })}
    </ol>
    {/* Narrow screens have no room for five tiles' words, so name just the current step. */}
    <p aria-hidden="true" className={'cx-steps-summary' + (current?.needsYou ? ' is-action' : '')}>
      {current ? 'Step ' + (index + 1) + ' of ' + steps.length + ': ' + current.label + (current.needsYou ? ' · you' : '') : 'All steps complete'}
    </p>
  </div>;
}
