import type { ClientProgressStep } from './clientProgressSteps';
import { Check } from 'lucide-react';

const stateText = { done: 'done', current: 'current step', upcoming: 'not started' } as const;

const visibleStateText = { done: 'Complete', current: 'Current', upcoming: 'Not started' } as const;

/** A compact path across the top of a ticket: where it is, and what is still ahead. */
export function ClientProgressStrip({ steps }: { steps: ClientProgressStep[] }) {
  if (steps.length === 0) return null;
  const index = steps.findIndex(step => step.state === 'current');
  const current = steps[index];
  return <div className="client-progress-strip">
    <div className="client-progress-overview">
      <span className="client-progress-caption">Request progress</span>
      <span className="client-progress-count">{current ? `Step ${index + 1} of ${steps.length}` : 'All steps complete'}</span>
    </div>
    <ol aria-label="Request progress" className="client-progress-steps">
      {steps.map((step, stepIndex) => <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className={`client-progress-step is-${step.state}${step.needsYou ? ' is-action' : ''}`}>
        <div className="client-progress-node-row" aria-hidden="true">
          <span className="client-progress-node">{step.state === 'done' ? <Check size={13} strokeWidth={2.5} /> : <span>{stepIndex + 1}</span>}</span>
          {stepIndex < steps.length - 1 && <span className={`client-progress-connector ${step.state === 'done' ? 'is-complete' : ''}`} />}
        </div>
        <span className="sr-only">{step.label}{step.needsYou ? ', your turn' : ''} ({stateText[step.state]})</span>
        <span aria-hidden="true" className="client-progress-label">{step.label}{step.needsYou ? ' · you' : ''}</span>
        <span aria-hidden="true" className="client-progress-state">{step.needsYou ? 'Your turn' : visibleStateText[step.state]}</span>
      </li>)}
    </ol>
    {/* Narrow screens have no room for five labels, so name just the current step. */}
    <p aria-hidden="true" className={`client-progress-mobile-summary ${current?.needsYou ? 'is-action' : ''}`}>
      {current ? `Step ${index + 1} of ${steps.length}: ${current.label}${current.needsYou ? ' · you' : ''}` : 'All steps complete'}
    </p>
  </div>;
}
