import type { ClientProgressStep } from './clientProgressSteps';

const stateText = { done: 'done', current: 'current step', upcoming: 'not started' } as const;

function barClass(step: ClientProgressStep): string {
  if (step.state === 'done') return 'bg-action';
  if (step.state === 'upcoming') return 'bg-surface-raised';
  return step.needsYou ? 'bg-amber-300' : 'bg-action';
}

function labelClass(step: ClientProgressStep): string {
  if (step.state === 'done') return 'text-content-secondary';
  if (step.state === 'upcoming') return 'text-content-secondary';
  return step.needsYou ? 'font-medium text-status-warning' : 'font-medium text-content';
}

/** A compact path across the top of a ticket: where it is, and what is still ahead. */
export function ClientProgressStrip({ steps }: { steps: ClientProgressStep[] }) {
  if (steps.length === 0) return null;
  const index = steps.findIndex(step => step.state === 'current');
  const current = steps[index];
  return <div className="client-progress-strip">
    <ol aria-label="Request progress" className="flex w-full items-start gap-1.5">
      {steps.map(step => {
        return <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className="min-w-0 flex-1">
          <span aria-hidden="true" className={`block h-1.5 rounded-full ${barClass(step)}`} />
          <span className="sr-only">{step.label}{step.needsYou ? ', your turn' : ''} ({stateText[step.state]})</span>
          <span aria-hidden="true" className={`mt-1.5 hidden truncate text-[10px] sm:block ${labelClass(step)}`}>{step.label}{step.needsYou ? ' · you' : ''}</span>
        </li>;
      })}
    </ol>
    {/* Narrow screens have no room for five labels, so name just the current step. */}
    <p aria-hidden="true" className={`mt-1.5 text-[11px] sm:hidden ${current?.needsYou ? 'font-medium text-status-warning' : 'text-content-secondary'}`}>
      {current ? `Step ${index + 1} of ${steps.length}: ${current.label}${current.needsYou ? ' · you' : ''}` : 'All steps complete'}
    </p>
  </div>;
}
