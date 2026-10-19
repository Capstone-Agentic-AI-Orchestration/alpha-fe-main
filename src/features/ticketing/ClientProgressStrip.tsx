import type { ClientProgressStep } from './clientProgressSteps';

const stateText = { done: 'done', current: 'current step', upcoming: 'not started' } as const;

/** A compact path across the top of a ticket: where it is, and what is still ahead. */
export function ClientProgressStrip({ steps }: { steps: ClientProgressStep[] }) {
  if (steps.length === 0) return null;
  const index = steps.findIndex(step => step.state === 'current');
  const current = steps[index];
  return <div className="mt-3 w-full">
    <ol aria-label="Request progress" className="flex w-full items-start gap-1.5">
      {steps.map(step => {
        const bar = step.state === 'done' ? 'bg-brand-400' : step.state === 'upcoming' ? 'bg-white/10' : step.needsYou ? 'bg-amber-300' : 'bg-brand-100';
        const text = step.state === 'current' ? (step.needsYou ? 'font-medium text-amber-100' : 'font-medium text-white') : step.state === 'done' ? 'text-gray-300' : 'text-gray-600';
        return <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className="min-w-0 flex-1">
          <span aria-hidden="true" className={`block h-1.5 rounded-full ${bar}`} />
          <span className="sr-only">{step.label}{step.needsYou ? ', your turn' : ''} ({stateText[step.state]})</span>
          <span aria-hidden="true" className={`mt-1.5 hidden truncate text-[10px] sm:block ${text}`}>{step.label}{step.needsYou ? ' · you' : ''}</span>
        </li>;
      })}
    </ol>
    {/* Narrow screens have no room for five labels, so name just the current step. */}
    <p aria-hidden="true" className={`mt-1.5 text-[11px] sm:hidden ${current?.needsYou ? 'font-medium text-amber-100' : 'text-gray-300'}`}>
      {current ? `Step ${index + 1} of ${steps.length}: ${current.label}${current.needsYou ? ' · you' : ''}` : 'All steps complete'}
    </p>
  </div>;
}
