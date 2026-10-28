import React from 'react';
import type { IssueBuildStatus } from '@/shared/services/apiService';

/** Builds that still occupy the Building column, whatever the issue's stored status. */
export const ACTIVE_BUILD_STATUSES = new Set([
  'planning', 'awaiting_plan_approval', 'executing', 'paused', 'validating',
  'awaiting_approval', 'publishing', 'cancelling', 'blocked', 'recovery_required'
]);

type Tone = 'info' | 'review' | 'wait' | 'muted' | 'alert' | 'done';

const DOT: Record<Tone, string> = {
  info: 'bg-status-info',
  review: 'bg-selected-content',
  wait: 'bg-status-warning',
  muted: 'bg-content-muted',
  alert: 'bg-status-danger',
  done: 'bg-status-success'
};

const TEXT: Record<Tone, string> = {
  info: 'text-status-info',
  review: 'text-selected-content',
  wait: 'text-status-warning',
  muted: 'text-content-secondary',
  alert: 'text-status-danger',
  done: 'text-status-success'
};

export const BUILD_STATES: Record<string, { label: string; tone: Tone; live?: boolean }> = {
  planning: { label: 'Planning', tone: 'info', live: true },
  awaiting_plan_approval: { label: 'Plan ready', tone: 'review' },
  executing: { label: 'Building', tone: 'info', live: true },
  validating: { label: 'Checking', tone: 'info', live: true },
  publishing: { label: 'Publishing', tone: 'info', live: true },
  paused: { label: 'Paused', tone: 'wait' },
  cancelling: { label: 'Stopping', tone: 'muted' },
  blocked: { label: 'Needs you', tone: 'alert' },
  recovery_required: { label: 'Needs you', tone: 'alert' },
  awaiting_approval: { label: 'Ready for review', tone: 'review' },
  completed: { label: 'Built', tone: 'done' },
  failed: { label: 'Build failed', tone: 'alert' }
};

/** A build's state as a dot and a word: status reads as text, not as a pill. */
export const BuildChip: React.FC<{ build?: IssueBuildStatus }> = ({ build }) => {
  const state = build ? BUILD_STATES[build.status] : undefined;
  if (!state) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11.25px] font-medium ${TEXT[state.tone]}`} title={`Orchestrator build: ${state.label}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[state.tone]} ${state.live ? 'animate-pulse' : ''}`} />
      {state.label}
    </span>
  );
};
