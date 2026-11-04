import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, parseApiError, type IssueBuildStatus } from '@/shared/services/apiService';
import type { ChatMessage, FeatureSpec, FeatureSpecRecord, Issue, ProjectBuildOrchestration, ProjectBuildSnapshot } from '@/shared/types';

const RUNNING = new Set(['planning', 'executing', 'validating', 'publishing', 'cancelling']);
const OPEN = new Set(['planning', 'awaiting_plan_approval', 'executing', 'paused', 'validating', 'awaiting_approval', 'publishing', 'cancelling', 'blocked', 'recovery_required']);

const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

/** Board threads start with this prefix; see the backend's boardThreads.ts. */
export const isBoardThreadId = (threadId?: string) => Boolean(threadId?.startsWith('task-'));

/**
 * A task's latest Orchestrator build, read from this desktop's own daemon.
 *
 * Loaded by run id, so a build started from chat before the board took over
 * still shows here. Polls quickly only while the build is running; nothing is
 * written to the shared board while it runs.
 */
export function useTaskBuild(issue: Pick<Issue, 'projectId'>, build: IssueBuildStatus | undefined, enabled: boolean) {
  const runId = build?.runId;
  const [snapshot, setSnapshot] = useState<ProjectBuildSnapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const request = useRef(0);
  const fetching = useRef('');

  const refresh = useCallback(async () => {
    if (!enabled || !runId) return;
    const key = `${issue.projectId}/${runId}`;
    if (fetching.current === key) return;
    fetching.current = key;
    const id = ++request.current;
    try {
      const next = await apiService.getProjectBuildSnapshot(issue.projectId, runId);
      if (id !== request.current) return;
      if (next.orchestration?.run.id === runId) {
        setSnapshot(next);
        setLoadError('');
      } else { setSnapshot(null); setLoadError('The build record changed. Refresh this task.'); }
    } catch (error) {
      if (id === request.current) { setSnapshot(null); setLoadError(message(error, 'The build could not be loaded.')); }
    } finally {
      if (fetching.current === key) fetching.current = '';
    }
  }, [enabled, issue.projectId, runId]);

  useEffect(() => {
    setSnapshot(null);
    setLoadError('');
    void refresh();
    return () => { request.current++; };
  }, [refresh]);

  const status = snapshot?.orchestration?.run.status ?? build?.status;
  useEffect(() => {
    if (!enabled || !runId || !status) return undefined;
    const delay = RUNNING.has(status) ? 3_000 : OPEN.has(status) ? 8_000 : 0;
    if (!delay) return undefined;
    const timer = window.setInterval(() => void refresh(), delay);
    return () => window.clearInterval(timer);
  }, [enabled, refresh, runId, status]);

  return {
    snapshot,
    orchestration: snapshot?.orchestration ?? null,
    loadError,
    refresh,
    canControl: !loadError && build?.fresh !== false && Boolean(snapshot?.canControlOrchestration ?? snapshot?.canRun),
    open: Boolean(status && OPEN.has(status)),
    running: Boolean(status && RUNNING.has(status))
  };
}

/** Evidence an accepted specialist report gave for each requirement. */
export function requirementEvidence(orchestration: ProjectBuildOrchestration | null): Map<string, string> {
  const evidence = new Map<string, string>();
  if (!orchestration) return evidence;
  for (const requirement of orchestration.requirements) {
    const tasks = orchestration.tasks.filter(task => task.required && task.status !== 'superseded' && task.requirementIds.includes(requirement.id));
    if (!tasks.some(task => task.kind === 'validation')) continue;
    const proofs = tasks.map(task => {
      const attempt = orchestration.attempts.filter(item => item.taskId === task.id).sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      return task.status === 'accepted' && attempt?.status === 'accepted'
        ? attempt.report?.requirementCoverage.find(item => item.requirementId === requirement.id)?.evidence?.trim() : undefined;
    });
    if (proofs.length && proofs.every(Boolean)) evidence.set(requirement.id, proofs.join(' '));
  }
  return evidence;
}

/** Files the accepted work changed, for the review summary. */
export function changedFiles(orchestration: ProjectBuildOrchestration | null): string[] {
  const files = new Set<string>();
  for (const attempt of orchestration?.attempts ?? []) {
    if (attempt.status === 'accepted') attempt.changedPaths.forEach(file => files.add(file));
  }
  return [...files].sort();
}

/**
 * The person's private conversation for this task's build.
 *
 * Reuses the thread the build already runs in. Opening a card never creates
 * one; the first question does, so browsing the board writes nothing.
 */
export function useBuildConversation(projectId: string, issueId: string, buildThreadId: string | undefined, live: boolean) {
  const [threadId, setThreadId] = useState<string | undefined>(isBoardThreadId(buildThreadId) ? buildThreadId : undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [privateToOwner, setPrivateToOwner] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    generation.current++;
    setThreadId(isBoardThreadId(buildThreadId) ? buildThreadId : undefined);
    setMessages([]);
    setPrivateToOwner(false);
    return () => { generation.current++; };
  }, [buildThreadId, issueId, projectId]);

  const load = useCallback(async (id = threadId) => {
    if (!id) return;
    const current = generation.current;
    try {
      const next = await apiService.getChatMessages(id);
      if (current !== generation.current) return;
      setMessages(next);
      setError('');
      setPrivateToOwner(false);
    } catch (failure) {
      if (current !== generation.current) return;
      const status = parseApiError(failure).status;
      setPrivateToOwner(status === 403);
      setError(status === 403 ? '' : message(failure, 'The conversation could not be loaded. Retry after reconnecting.'));
    }
  }, [threadId]);

  useEffect(() => {
    void load();
    if (!threadId || !live) return undefined;
    const timer = window.setInterval(() => void load(), 8_000);
    return () => window.clearInterval(timer);
  }, [live, load, threadId]);

  const ask = async (question: string) => {
    const content = question.trim();
    if (!content) return false;
    const current = generation.current;
    setSending(true);
    setError('');
    try {
      const id = threadId ?? (await apiService.getBoardThread(projectId, issueId)).id;
      if (current !== generation.current) return false;
      if (!threadId) setThreadId(id);
      await apiService.sendChatMessage({
        threadId: id, content, projectId, intent: 'ask',
        clientMessageId: `msg-${Date.now()}-${crypto.randomUUID()}`
      });
      await load(id);
      return true;
    } catch (failure) {
      if (current !== generation.current) return false;
      setError(message(failure, 'Your question was not sent.'));
      return false;
    } finally {
      if (current === generation.current) setSending(false);
    }
  };

  return { threadId, messages, sending, error, privateToOwner, ask };
}

/** A task's feature spec, stored on this desktop. */
export function useFeatureSpec(issue: Pick<Issue, 'id' | 'projectId'>, enabled: boolean) {
  const [record, setRecord] = useState<FeatureSpecRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      setRecord((await apiService.getFeatureSpec(issue.projectId, issue.id)).spec);
      setError('');
    } catch (failure) {
      setError(message(failure, 'The feature spec could not be loaded.'));
    } finally {
      setLoaded(true);
    }
  }, [enabled, issue.id, issue.projectId]);

  useEffect(() => {
    setRecord(null);
    setLoaded(false);
    void load();
  }, [load]);

  const run = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    setError('');
    try {
      return await action();
    } catch (failure) {
      setError(message(failure, 'The feature spec action failed.'));
      await load();
      return null;
    } finally {
      setBusy(null);
    }
  };

  const version = record?.version ?? 0;
  return {
    record, loaded, busy, error, reload: load,
    draft: (request?: string) => run('draft', async () => {
      const result = await apiService.draftFeatureSpec(issue.projectId, issue.id, { expectedVersion: version, request });
      setRecord(result.spec);
      return result.spec;
    }),
    revise: (revision: string) => run('revise', async () => {
      const result = await apiService.draftFeatureSpec(issue.projectId, issue.id, { expectedVersion: version, revision });
      setRecord(result.spec);
      return result.spec;
    }),
    save: (spec: FeatureSpec) => run('save', async () => {
      const result = await apiService.saveFeatureSpec(issue.projectId, issue.id, version, spec);
      setRecord(result.spec);
      return result.spec;
    }),
    approve: () => run('approve', async () => {
      const result = await apiService.approveFeatureSpec(issue.projectId, issue.id, version);
      setRecord(result.spec);
      return result.issue;
    }),
    remove: () => run('remove', async () => {
      await apiService.deleteFeatureSpec(issue.projectId, issue.id);
      setRecord(null);
      return true;
    })
  };
}

