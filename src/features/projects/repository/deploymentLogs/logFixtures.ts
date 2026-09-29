import type { DeploymentLogLine, DeploymentLogsResponse } from './logTypes';

/** Test builders: one log line, and a page of them. */

export function line(id: string, second: number, overrides: Partial<DeploymentLogLine> = {}): DeploymentLogLine {
  return {
    id,
    timestamp: `2026-09-24T10:00:${String(second).padStart(2, '0')}.000Z`,
    message: `message ${id}`,
    level: 'info',
    type: 'app',
    instance: 'srv-d1abc-5d8f9c7b6-x2k4j',
    labels: {},
    ...overrides
  };
}

export function page(
  logs: DeploymentLogLine[],
  overrides: Partial<DeploymentLogsResponse> = {}
): DeploymentLogsResponse {
  return {
    source: 'live',
    logs,
    hasMore: false,
    next: null,
    filters: ['level', 'type', 'text', 'instance'],
    ...overrides
  };
}
