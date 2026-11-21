import { useRef, useState } from 'react';

import { apiService } from '@/shared/services/apiService';

type DeliveryApi = Pick<typeof apiService, 'getOrchestrationDelivery' | 'orchestrationDeliveryAction'>;

export type DevMergeOutcome = { merged: true; message: string } | { merged: false; message: string };

const repoName = (repository: string) => repository.split('/').pop() || repository;

/**
 * Merge a finished build's pull request(s) into dev through the typed delivery action,
 * at the delivery revision just read, so a stale screen cannot merge something else.
 * Never throws: a refusal comes back as the reason to show next to the button.
 */
export async function mergeIntoDev(projectId: string, runId: string, key: string, api: DeliveryApi = apiService): Promise<DevMergeOutcome> {
  try {
    const { delivery, canPromote } = await api.getOrchestrationDelivery(projectId, runId);
    if (!canPromote) return { merged: false, message: 'Your workspace role cannot merge builds. A developer, PM, or admin can merge it.' };
    if (!delivery) return { merged: false, message: 'This build has no pull request to merge yet.' };
    if (delivery.stage !== 'dev_approval') return { merged: false, message: `Not ready to merge into dev: ${delivery.reason}` };
    const merged = await api.orchestrationDeliveryAction(projectId, runId, 'merge_dev', delivery.revision, key);
    const names = merged.repositories.map(repo => repoName(repo.repository)).join(', ');
    return { merged: true, message: `Merged ${names || 'the pull request'} into dev. CI runs on dev next; promotion to UAT is a separate step.` };
  } catch (error) {
    return { merged: false, message: `Not merged: ${error instanceof Error ? error.message : 'the merge request failed. Refresh and try again.'}` };
  }
}

/** The Merge into dev button's state: one request at a time, and its result kept on screen. */
export function useDevMerge(projectId: string, runId: string) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<DevMergeOutcome | null>(null);
  const inFlight = useRef(false);
  const merge = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await mergeIntoDev(projectId, runId, crypto.randomUUID()));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { merge, busy, outcome };
}
