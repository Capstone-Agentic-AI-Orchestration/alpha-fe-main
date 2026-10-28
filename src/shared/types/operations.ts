export type OperationsEnvironment = 'production' | 'staging';
export type TicketPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';
export type TicketSlaState = 'unconfigured' | 'on_track' | 'at_risk' | 'met' | 'breached';

export interface OperationsSummary {
  activeProjects: number; deployments24h: number; openIncidents: number; monitoredTargets: number;
  productionUptimePercent30d: number | null; productionTargetPercent: number;
}

export interface OperationsDeployment {
  id: string; projectId: string; projectName: string; repository: string; provider: 'render' | 'vercel';
  providerDeploymentId: string; environment: OperationsEnvironment; status: string; branch: string | null;
  commitSha: string | null; commitMessage: string | null; url: string | null; createdBy: string | null;
  startedAt: string; finishedAt: string | null;
}

export interface OperationsProbeSample { checkedAt: string; ok: boolean; latencyMs: number }
export interface OperationsTarget {
  id: string; projectId: string; projectName: string; repository: string; environment: OperationsEnvironment;
  kind: 'service' | 'domain'; provider: 'render' | 'vercel'; url: string; checkPath: string;
  targetPercent: number | null; lastCheckedAt: string | null; coverageStart: string | null; samples30d: number;
  uptimePercent30d: number | null; recentSamples: OperationsProbeSample[];
}

export interface OperationsIncident {
  id: string; projectId: string; projectName: string; repository: string; environment: OperationsEnvironment;
  kind: 'service' | 'domain'; url: string; startedAt: string; resolvedAt: string | null; lastError: string | null;
}

export interface OperationsTicketPolicy {
  priority: TicketPriority; responseMinutes: number; resolutionMinutes: number; updatedBy: string; updatedAt: string | null;
}
export interface OperationsTicketSlaMetric {
  targetMinutes: number | null; elapsedMinutes: number | null; stoppedAt: string | null;
  state: TicketSlaState;
}
export interface OperationsTicket {
  id: string; reference: string; title: string; status: string; priority: TicketPriority;
  startedAt: string | null; firstResponseAt: string | null; closedAt: string | null;
  response: OperationsTicketSlaMetric; resolution: OperationsTicketSlaMetric;
}

export interface OperationsExpense {
  id: string; projectId: string; projectName?: string; description: string; vendor: string | null; category: string;
  amountUsd: number; recurrence: 'one_off' | 'monthly' | 'annual'; effectiveAt: string; endsAt: string | null;
  createdBy: string; createdAt: string | null;
}
export interface OperationsProjectCost {
  projectId: string; projectName: string; status: string; aiRunCostUsd: number | null; reportedRunCount: number;
  unreportedRunCount: number; manualExpenseUsd: number; totalKnownUsd: number; budgetUsd: number | null;
  expenses: OperationsExpense[]; targetDate: string | null; completedAt: string | null;
  targetPerformance: 'on_track' | 'late' | 'upcoming' | 'unconfigured';
}
export interface OperationsMilestone {
  projectId: string; projectName: string; id: string; title: string; targetDate: string; completed: boolean;
  completedAt?: string; targetPerformance: 'on_track' | 'late' | 'upcoming' | 'unconfigured';
}
export interface OperationsNotification {
  id: string; type: 'ops_incident'; title: string; message: string; read: boolean; archived?: boolean; timestamp: string;
  entityType: 'ops_incident'; entityId: string; eventType: 'opened' | 'resolved';
}
export interface OperationsSnapshot {
  generatedAt: string; summary: OperationsSummary; projects: OperationsProjectCost[]; milestones: OperationsMilestone[];
  deployments: OperationsDeployment[]; targets: OperationsTarget[]; incidents: OperationsIncident[];
  ticketPolicies: OperationsTicketPolicy[]; ticketSlaConfigured: boolean; tickets: OperationsTicket[];
  expenses: OperationsExpense[]; notifications: OperationsNotification[]; lastDeploymentImportAt: string | null;
}
