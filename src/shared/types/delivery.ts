export interface OrchestrationDelivery {
  runId: string; projectId: string; revision: number; stage: string; reason: string;
  repairAttempts: number; repairRunId?: string;
  authorization?: { actorId: string; grantedAt: string; paused: boolean };
  repositories: Array<{
    repository: string; head: string; devBase?: string; devHead?: string; uatBase?: string; uatHead?: string;
    prUrl: string; uatPrUrl?: string; requiredChecks: string[];
    checks: Array<{ name: string; state: 'passed' | 'pending' | 'failed'; url?: string }>;
    deployment?: { sha: string; url: string; status: string; verifiedAt?: string };
  }>;
  history: Array<{ at: string; actorId: string; action: string; detail: string }>;
}
export type DeliveryAction = 'enable_uat' | 'pause_delivery' | 'resume_delivery' | 'merge_dev' | 'prepare_uat' | 'merge_uat' | 'prepare_repair';
export interface DeliveryResponse { delivery: OrchestrationDelivery | null; canControl: boolean; canPromote: boolean }
