import type { ClientProgressStep } from './clientProgressSteps';
import { Check } from 'lucide-react';

const stateText = { done: 'done', current: 'current step', upcoming: 'not started' } as const;

/** A compact path across the top of a request: where it is, and what is still ahead. */
export function ClientProgressStrip({ steps }: { steps: ClientProgressStep[] }) {
  if (steps.length === 0) return null;
  const index = steps.findIndex(step => step.state === 'current');
  const current = steps[index];
  return <div className="cx-steps">
    <ol aria-label="Request progress" className="cx-steps-list">
      {steps.map((step, stepIndex) => <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className={'cx-step is-' + step.state + (step.needsYou ? ' is-action' : '')}>
        <span className="cx-step-node" aria-hidden="true">{step.state === 'done' ? <Check size={13} strokeWidth={2.5} /> : stepIndex + 1}</span>
        <span className="sr-only">{step.label}{step.needsYou ? ', your turn' : ''} ({stateText[step.state]})</span>
        <span aria-hidden="true" className="cx-step-label">{step.label}{step.needsYou ? ' · you' : ''}</span>
      </li>)}
    </ol>
    {/* Narrow screens have no room for five labels, so name just the current step. */}
    <p aria-hidden="true" className={'cx-steps-summary' + (current?.needsYou ? ' is-action' : '')}>
      {current ? 'Step ' + (index + 1) + ' of ' + steps.length + ': ' + current.label + (current.needsYou ? ' · you' : '') : 'All steps complete'}
    </p>
  </div>;
}
