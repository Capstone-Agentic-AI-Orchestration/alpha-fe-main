import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { ReviewDiff } from '@/features/project-build-review/OrchestrationWorkflowPanel';
import type { ProjectBuildOrchestration } from '@/shared/types';

type Command = { script?: string; display?: string; exitCode: number | null; signal: string | null };

function commandPassed(command: Command): boolean {
  return command.exitCode === 0 && command.signal === null;
}

function commandResult(command: Command): string {
  if (commandPassed(command)) return 'passed';
  if (command.signal) return 'stopped · ' + command.signal;
  return command.exitCode === null ? 'unknown' : 'exit ' + command.exitCode;
}

function finalChecks(orchestration: ProjectBuildOrchestration): Array<{ repository?: string; commands: Command[]; missingScripts: string[] }> {
  const validation = orchestration.finalValidation;
  if (!validation) return [];
  if (validation.repositories?.length) return validation.repositories;
  return [{ commands: validation.commands, missingScripts: validation.missingScripts }];
}

export const PlanBody: React.FC<{ orchestration: ProjectBuildOrchestration }> = ({ orchestration }) => {
  const order = new Map(orchestration.tasks.map((task, index) => [task.id, index + 1]));
  return <>
    {orchestration.run.goal && <p className="text-xs leading-5 text-content-secondary">{orchestration.run.goal}</p>}
    <ol className="space-y-2">
      {orchestration.tasks.map((task, index) => <li key={task.id} className="rounded-xl border border-divider bg-surface-raised px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-selected text-[10px] font-semibold text-selected-content">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-medium text-content">{task.title}</span>
              <span className="rounded-full border border-divider bg-selected px-2 py-0.5 text-[10px] text-selected-content">{task.ownerName}</span>
              {task.dependsOn.length > 0 && <span className="text-[10px] text-content-muted">after {task.dependsOn.map(id => '#' + (order.get(id) ?? '?')).join(', ')}</span>}
              {!task.required && <span className="text-[10px] text-content-muted">optional</span>}
            </div>
            {task.assignmentReason && <p className="mt-1 text-[11px] leading-4 text-content-secondary"><span className="text-link">Why {task.ownerName}:</span> {task.assignmentReason}</p>}
            {(task.description || task.acceptanceCriteria.length > 0 || task.requiredChecks.length > 0) && <details className="group mt-1.5">
              <summary className="cursor-pointer list-none text-[10px] font-medium text-link hover:text-link-hover [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show details</span><span className="hidden group-open:inline">Hide details</span></summary>
              <div className="mt-2 space-y-2 text-[11px] leading-4 text-content-secondary">
                {task.description && <p className="whitespace-pre-wrap">{task.description}</p>}
                {task.acceptanceCriteria.length > 0 && <div><div className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Done when</div><ul className="mt-1 list-disc space-y-0.5 pl-4">{task.acceptanceCriteria.map(item => <li key={item}>{item}</li>)}</ul></div>}
                {task.requiredChecks.length > 0 && <div><div className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">Checks</div><div className="mt-1 flex flex-wrap gap-1">{task.requiredChecks.map(check => <code key={check} className="rounded-md bg-well px-1.5 py-0.5 text-[10px] text-content-secondary">{check}</code>)}</div></div>}
              </div>
            </details>}
          </div>
        </div>
      </li>)}
    </ol>
    {orchestration.run.exclusions.length > 0 && <div className="text-[11px] leading-4 text-content-secondary"><span className="font-semibold text-content-secondary">Left out of this build:</span> {orchestration.run.exclusions.join('; ')}</div>}
  </>;
};

export const ReviewBody: React.FC<{ projectId: string; orchestration: ProjectBuildOrchestration; expandedDiff?: boolean; onDiffReady?: () => void }> = ({ projectId, orchestration, expandedDiff, onDiffReady }) => {
  const checks = finalChecks(orchestration);
  const openFindings = orchestration.findings.filter(finding => finding.status === 'open');
  return <>
    {orchestration.run.goal && <p className="text-xs leading-5 text-content-secondary">{orchestration.run.goal}</p>}
    <ul className="space-y-1">
      {orchestration.tasks.filter(task => task.required).map(task => <li key={task.id} className="flex items-start justify-between gap-3 text-[11px]">
        <span className="min-w-0 text-content">{task.title} <span className="text-content-muted">· {task.ownerName}</span></span>
        <span className={'shrink-0 capitalize ' + (task.status === 'accepted' ? 'text-status-success' : 'text-status-warning')}>{task.status === 'accepted' ? 'done' : task.status.replace(/_/g, ' ')}</span>
      </li>)}
    </ul>
    <div className="rounded-xl border border-divider bg-well px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-content-muted"><span>Final checks</span><span className={'normal-case tracking-normal ' + (orchestration.finalValidation?.status === 'passed' ? 'text-status-success' : 'text-status-warning')}>{orchestration.finalValidation?.status ?? 'not recorded'}</span></div>
      {checks.length ? checks.map((group, index) => <div key={group.repository ?? index} className="mt-1.5 space-y-1">
        {group.repository && checks.length > 1 && <div className="text-[10px] font-semibold text-content-secondary">{group.repository}</div>}
        {group.commands.map((command, commandIndex) => <div key={commandIndex} className="flex justify-between gap-3 text-[11px] text-content-secondary"><span className="truncate">{command.script || command.display || 'Check'}</span><span className={commandPassed(command) ? 'text-status-success' : 'text-status-danger'}>{commandResult(command)}</span></div>)}
        {group.commands.length === 0 && <p className="text-[11px] text-content-muted">No checks were recorded.</p>}
        {group.missingScripts.length > 0 && <p className="text-[10px] text-status-warning">Not set up in this codebase: {group.missingScripts.join(', ')}</p>}
      </div>) : <p className="mt-1 text-[11px] text-content-muted">No final checks were recorded.</p>}
    </div>
    {openFindings.length > 0 && <div className="rounded-xl border border-status-warning-border bg-status-warning-subtle px-3 py-2.5 text-[11px] text-status-warning">
      <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />{openFindings.length} open {openFindings.length === 1 ? 'finding' : 'findings'}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-status-warning">{openFindings.map(finding => <li key={finding.id}>{finding.title ?? finding.instruction ?? finding.severity}{finding.path ? ' · ' + finding.path : ''}</li>)}</ul>
    </div>}
    <ReviewDiff projectId={projectId} runId={orchestration.run.id} branchName={orchestration.run.branchName} expanded={expandedDiff} onReady={onDiffReady} />
  </>;
};
