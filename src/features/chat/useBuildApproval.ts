import { useRef, useState } from 'react';

import { apiService, userMessage } from '@/shared/services/apiService';
import type { ProjectBuildOrchestration } from '@/shared/types';

/** Why approval is not offered for this build right now, or null when it is. */
export function approvalBlocker(orchestration: ProjectBuildOrchestration, canApprove: boolean): string | null {
  if (!canApprove) return 'A developer, PM, or admin must approve publication.';
  if (orchestration.findings.some(item => item.status === 'open' && ['blocking', 'critical'].includes(item.severity))) {
    return 'Blocking findings must be resolved before approval.';
  }
  return null;
}

/**
 * Approve a finished build from a button: pushes the reviewed revision and opens its
 * pull request(s). The same call the project build review page makes; the revision
 * makes sure what is approved is exactly what was reviewed. Typing the decision in the
 * main chat still works too.
 */
export function useBuildApproval(projectId: string, orchestration: ProjectBuildOrchestration | null | undefined, canApprove: boolean, onApproved?: () => void | Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const blocker = orchestration ? approvalBlocker(orchestration, canApprove) : 'The build is still loading.';

  const approve = async () => {
    if (!orchestration || blocker || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await apiService.approveOrchestration(projectId, orchestration.run.id, orchestration.run.revision);
      await onApproved?.();
    } catch (failure) {
      setError(userMessage(failure, 'Publication could not be authorized. Refresh and try again.'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { approve, busy, error, blocker };
}
