/** Review context only. The server interprets the unchanged human message. */
export interface ChatBuildDecision {
  runId: string;
  expectedRevision: number;
  planVersion: number;
  evidenceReady: boolean;
}

export function buildDecisionContext(build: {
  runId: string; revision: number; status: string; orchestration: { run: { planVersion: number } };
} | null | undefined, readingAnotherBuild: boolean): ChatBuildDecision | undefined {
  if (!build || !['awaiting_plan_approval', 'awaiting_approval', 'publishing'].includes(build.status)) return undefined;
  return { runId: build.runId, expectedRevision: build.revision,
    planVersion: build.orchestration.run.planVersion, evidenceReady: !readingAnotherBuild };
}
