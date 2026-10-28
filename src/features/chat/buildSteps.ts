import type { LiveBuildOrchestrationStatus } from '@/shared/types';

export type WizardStep = 'plan' | 'approve' | 'build' | 'review' | 'publish';

export const BUILD_STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'approve', label: 'Approve' },
  { id: 'build', label: 'Build' },
  { id: 'review', label: 'Review' },
  { id: 'publish', label: 'Pull request' }
];

/** Which step a build is on, and whether that step needs the person. No build yet means planning comes next. */
export function buildStepFor(status: LiveBuildOrchestrationStatus | null | undefined): { step: WizardStep; attention: boolean } {
  switch (status) {
    case undefined:
    case null: return { step: 'plan', attention: true };
    case 'planning': return { step: 'plan', attention: false };
    case 'awaiting_plan_approval': return { step: 'approve', attention: true };
    case 'paused':
    case 'blocked':
    case 'recovery_required': return { step: 'build', attention: true };
    case 'awaiting_approval': return { step: 'review', attention: true };
    case 'publishing': return { step: 'publish', attention: false };
    default: return { step: 'build', attention: false };
  }
}
