/** Decisions are explicit main-chat replies to the displayed plan or publication review. */
export interface ChatBuildDecision {
  action: 'start' | 'approve' | 'retry_publication';
  runId: string;
  expectedRevision: number;
  planVersion: number;
  evidenceReady: boolean;
}

export function buildDecisionAction(content: string): ChatBuildDecision['action'] | undefined {
  const text = content.trim().toLowerCase().replace(/[.!]+$/, '');
  if (/^(?:please )?(?:start(?: it| the (?:plan|build|planned work))?|go ahead(?: with (?:this|the) plan)?|continue|proceed)$/.test(text)) return 'start';
  if (/^(?:please )?(?:approve|approve (?:publication|the (?:publication|pull request))|publish (?:it|this build)|push and open (?:the |a )?pull request)$/.test(text)) return 'approve';
  if (/^(?:please )?retry publication$/.test(text)) return 'retry_publication';
  return undefined;
}
