import type {
  Agent,
  AnalyticsData,
  Deployment,
  InboxNotification,
  Issue,
  PrototypeRun,
  RequirementDoc,
  WorkspaceSettings
} from '@/shared/types';

const LEGACY_AGENT_NAMES = new Map<string, string>([
  ['agent-1', 'Ada Lovelace'],
  ['agent-2', 'Kaelen Vance'],
  ['agent-3', 'Vesper Nyx'],
  ['agent-4', 'Nyx Orion'],
  ['agent-5', 'Cipher Drake'],
  ['agent-6', 'Atlas Prime'],
  ['agent-7', 'Echo Legacy']
]);

const LEGACY_ISSUE_IDENTIFIERS = new Map<string, string>([
  ['iss-1', 'ALF-101'],
  ['iss-2', 'ALF-104'],
  ['iss-3', 'NEU-205'],
  ['iss-4', 'ALF-109'],
  ['iss-5', 'GRD-302'],
  ['iss-6', 'NEU-209'],
  ['iss-alp-41', 'ALP-41'],
  ['iss-alp-42', 'ALP-42'],
  ['iss-alp-40', 'ALP-40'],
  ['iss-alp-39', 'ALP-39'],
  ['iss-alp-38', 'ALP-38'],
  ['iss-alp-36', 'ALP-36'],
  ['iss-alp-24', 'ALP-24'],
  ['iss-alp-12', 'ALP-12'],
  ['iss-alp-23', 'ALP-23'],
  ['iss-alp-22', 'ALP-22']
]);

const LEGACY_DEPLOYMENTS = new Map<string, { projectName: string; name: string }>([
  ['dep-101', { projectName: 'E-Wallet', name: 'Production Deploy v2.4.0' }],
  ['dep-102', { projectName: 'Capstone', name: 'PR #42 Preview Build' }],
  ['dep-103', { projectName: 'ServEase', name: 'Nightly Canary Release' }],
  ['dep-104', { projectName: 'Calculator', name: 'Release v1.2.0 Staging' }]
]);

const LEGACY_INBOX_IDS = new Set([
  'notif-client-1',
  'notif-client-2',
  'notif-1',
  'notif-2',
  'notif-3'
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

/**
 * Honest runtime defaults.
 *
 * These values describe an empty installation. They are deliberately not a
 * demo workspace, a sample user, or a set of pretend credentials. The daemon
 * and the authenticated workspace populate real data after startup.
 */
export const emptyAnalytics: AnalyticsData = {
  totalRuns24h: 0,
  avgLatencyMs: 0,
  totalAgentRuns: 0,
  successRate: 0,
  runTimeline: [],
  agentBreakdown: [],
  modelBreakdown: []
};

export const emptyApiKeys: WorkspaceSettings['apiKeys'] = {
  openai: '',
  anthropic: '',
  gemini: '',
  groq: '',
  huggingface: ''
};

export const defaultSettings: WorkspaceSettings = {
  workspaceName: '',
  workspaceSlug: '',
  activeTheme: 'dark',
  apiKeys: emptyApiKeys,
  localRuntimeUrl: '',
  enableAutoTriage: false,
  defaultAutonomy: 'Semi-Autonomous (Requires Approval)',
  notificationsEnabled: true,
  telemetryEnabled: false,
  maxParallelAgentRuns: 4
};

/** Remove only records that match the removed browser demo dataset exactly. */
export function normalizeLegacyAgents(value: unknown): Agent[] {
  return asArray<Agent>(value).filter(item => {
    const row = asRecord(item);
    if (!row) return false;
    const expectedName = LEGACY_AGENT_NAMES.get(String(row.id ?? ''));
    return !expectedName || String(row.name ?? '') !== expectedName;
  });
}

/** Remove only issue rows whose old id and old identifier both match. */
export function normalizeLegacyIssues(value: unknown): Issue[] {
  return asArray<Issue>(value).filter(item => {
    const row = asRecord(item);
    if (!row) return false;
    const expectedIdentifier = LEGACY_ISSUE_IDENTIFIERS.get(String(row.id ?? ''));
    return !expectedIdentifier || String(row.identifier ?? '') !== expectedIdentifier;
  });
}

/** The old deployments were presentation-only records, never CI results. */
export function normalizeLegacyDeployments(value: unknown): Deployment[] {
  return asArray<Deployment>(value).filter(item => {
    const row = asRecord(item);
    if (!row) return false;
    const expected = LEGACY_DEPLOYMENTS.get(String(row.id ?? ''));
    return !expected ||
      String(row.projectName ?? '') !== expected.projectName ||
      String(row.name ?? '') !== expected.name;
  });
}

/**
 * Discard the retired browser-only run simulation, and strip its fake PR URL
 * from any record that otherwise remains useful. The marker pair was never
 * emitted by the daemon, so requiring both avoids touching real run history.
 */
export function normalizeLegacyPrototypeRuns(value: unknown): PrototypeRun[] {
  return asArray<PrototypeRun>(value).flatMap(item => {
    const row = asRecord(item);
    if (!row) return [];

    const isRetiredSimulation = asArray<Record<string, unknown>>(row.stages).some(stage => {
      const logs = asArray<string>(stage.logs);
      return logs.includes('Workspace context restored.') && logs.includes('Created isolated prototype branch.');
    });
    if (isRetiredSimulation) return [];

    if (typeof row.prUrl === 'string' && row.prUrl.includes('/pull/mock-')) {
      return [{ ...item, prUrl: undefined }];
    }
    return [item];
  });
}

/** Inbox cleanup deliberately keys on known demo IDs, never on ordinary words. */
export function normalizeInboxNotifications(value: unknown): InboxNotification[] {
  return asArray<InboxNotification>(value).filter(item => {
    const row = asRecord(item);
    if (!row) return false;
    return !LEGACY_INBOX_IDS.has(String(row.id ?? ''));
  });
}

/** Detect the exact aggregate shipped by the retired demo, not real telemetry. */
export function isLegacyDemoAnalytics(value: unknown): boolean {
  const raw = asRecord(value);
  if (!raw) return false;
  if (
    Number(raw.totalRuns24h) !== 34 ||
    Number(raw.totalAgentRuns) !== 89 ||
    Number(raw.successRate) !== 98.4
  ) return false;

  const agents = asArray<Record<string, unknown>>(raw.agentBreakdown);
  return agents.some(agent =>
    String(agent.agentId ?? '') === 'agent-2' &&
    String(agent.agentName ?? '') === 'Kaelen Vance (Coder)'
  );
}

/**
 * Merge persisted settings without reviving the masked API-key examples that
 * older builds stored as if they were real credentials.
 */
export function normalizeSettings(value: unknown): WorkspaceSettings {
  const raw = value && typeof value === 'object' ? value as Partial<WorkspaceSettings> : {};
  const rawKeys = raw.apiKeys && typeof raw.apiKeys === 'object' ? raw.apiKeys : {};
  const cleanKey = (candidate: unknown): string => {
    if (typeof candidate !== 'string') return '';
    // Older demo settings used bullet characters to imitate secret values.
    return /[•]|â€¢/.test(candidate) ? '' : candidate;
  };

  return {
    ...defaultSettings,
    ...raw,
    // This was a product demo slug, not a workspace discovered from the API.
    workspaceSlug: raw.workspaceSlug === 'alpha-multica-hq' ? '' : String(raw.workspaceSlug ?? ''),
    apiKeys: {
      openai: cleanKey((rawKeys as Record<string, unknown>).openai),
      anthropic: cleanKey((rawKeys as Record<string, unknown>).anthropic),
      gemini: cleanKey((rawKeys as Record<string, unknown>).gemini),
      groq: cleanKey((rawKeys as Record<string, unknown>).groq),
      huggingface: cleanKey((rawKeys as Record<string, unknown>).huggingface)
    }
  };
}

/** Drop the two requirement records shipped by the removed demo dataset. */
export function normalizeRequirementDocs(value: unknown): RequirementDoc[] {
  if (!Array.isArray(value)) return [];
  const legacyIds = new Set(['doc-1042', 'doc-1041']);
  const legacyIdentifiers = new Set(['SPEC-1042', 'SPEC-1041']);
  return value.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Partial<RequirementDoc>;
    return !legacyIds.has(String(row.id)) && !legacyIdentifiers.has(String(row.identifier));
  }) as RequirementDoc[];
}

/**
 * Remove known legacy demo rows from every cached workspace once.
 *
 * The daemon remains authoritative whenever it is reachable. This only covers
 * offline browser state so an older local cache cannot resurrect records after
 * the mock module has been removed from the bundle.
 */
export function migrateLegacyMockStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    const prefix = 'alpha_multica_';
    const marker = `${prefix}mock_data_cleanup_v3`;
    if (storage.getItem(marker) === '1') return;

    const normalizers: Record<string, (value: unknown) => unknown> = {
      agents: normalizeLegacyAgents,
      issues: normalizeLegacyIssues,
      deployments_v2: normalizeLegacyDeployments,
      prototype_runs: normalizeLegacyPrototypeRuns,
      inbox: normalizeInboxNotifications,
      analytics_v2: value => isLegacyDemoAnalytics(value) ? emptyAnalytics : value,
      settings: normalizeSettings,
      requirement_docs: normalizeRequirementDocs
    };

    Object.keys(storage)
      .filter(key => key.startsWith(prefix))
      .forEach(key => {
        const collection = key.slice(prefix.length).split(':', 1)[0];
        const normalize = normalizers[collection];
        if (!normalize) return;

        const raw = storage.getItem(key);
        if (!raw) return;
        try {
          storage.setItem(key, JSON.stringify(normalize(JSON.parse(raw))));
        } catch {
          // A malformed cache entry is already ignored by loadFromStorage.
        }
      });

    storage.setItem(marker, '1');
  } catch {
    // Storage may be unavailable in private or embedded browser contexts.
  }
}
