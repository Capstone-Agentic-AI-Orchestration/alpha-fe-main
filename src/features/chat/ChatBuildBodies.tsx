import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { ReviewDiff } from '@/features/live-build-room/OrchestrationWorkflowPanel';
import type { LiveBuildRoomOrchestration } from '@/shared/types';

type Command = { script?: string; display?: string; exitCode: number | null; signal: string | null };

function commandPassed(command: Command): boolean {
  return command.exitCode === 0 && command.signal === null;
}

function commandResult(command: Command): string {
  if (commandPassed(command)) return 'passed';
  if (command.signal) return 'stopped · ' + command.signal;
  return command.exitCode === null ? 'unknown' : 'exit ' + command.exitCode;
}

function finalChecks(orchestration: LiveBuildRoomOrchestration): Array<{ repository?: string; commands: Command[]; missingScripts: string[] }> {
  const validation = orchestration.finalValidation;
  if (!validation) return [];
  if (validation.repositories?.length) return validation.repositories;
  return [{ commands: validation.commands, missingScripts: validation.missingScripts }];
}

export const PlanBody: React.FC<{ orchestration: LiveBuildRoomOrchestration }> = ({ orchestration }) => {
  const order = new Map(orchestration.tasks.map((task, index) => [task.id, index + 1]));
  return <>
    {orchestration.run.goal && <p className="text-xs leading-5 text-gray-300">{orchestration.run.goal}</p>}
    <ol className="space-y-2">
      {orchestration.tasks.map((task, index) => <li key={task.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-400/15 text-[10px] font-semibold text-violet-100">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-medium text-white">{task.title}</span>
              <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-100">{task.ownerName}</span>
              {task.dependsOn.length > 0 && <span className="text-[10px] text-gray-500">after {task.dependsOn.map(id => '#' + (order.get(id) ?? '?')).join(', ')}</span>}
              {!task.required && <span className="text-[10px] text-gray-500">optional</span>}
            </div>
            {task.assignmentReason && <p className="mt-1 text-[11px] leading-4 text-gray-400"><span className="text-violet-200/80">Why {task.ownerName}:</span> {task.assignmentReason}</p>}
            {(task.description || task.acceptanceCriteria.length > 0 || task.requiredChecks.length > 0) && <details className="group mt-1.5">
              <summary className="cursor-pointer list-none text-[10px] font-medium text-violet-200 hover:text-violet-100 [&::-webkit-details-marker]:hidden"><span className="group-open:hidden">Show details</span><span className="hidden group-open:inline">Hide details</span></summary>
              <div className="mt-2 space-y-2 text-[11px] leading-4 text-gray-300">
                {task.description && <p className="whitespace-pre-wrap">{task.description}</p>}
                {task.acceptanceCriteria.length > 0 && <div><div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Done when</div><ul className="mt-1 list-disc space-y-0.5 pl-4">{task.acceptanceCriteria.map(item => <li key={item}>{item}</li>)}</ul></div>}
                {task.requiredChecks.length > 0 && <div><div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Checks</div><div className="mt-1 flex flex-wrap gap-1">{task.requiredChecks.map(check => <code key={check} className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] text-gray-300">{check}</code>)}</div></div>}
              </div>
            </details>}
          </div>
        </div>
      </li>)}
    </ol>
    {orchestration.run.exclusions.length > 0 && <div className="text-[11px] leading-4 text-gray-400"><span className="font-semibold text-gray-300">Left out of this build:</span> {orchestration.run.exclusions.join('; ')}</div>}
  </>;
};

export const ReviewBody: React.FC<{ projectId: string; orchestration: LiveBuildRoomOrchestration; expandedDiff?: boolean; onDiffReady?: () => void }> = ({ projectId, orchestration, expandedDiff, onDiffReady }) => {
  const checks = finalChecks(orchestration);
  const openFindings = orchestration.findings.filter(finding => finding.status === 'open');
  return <>
    {orchestration.run.goal && <p className="text-xs leading-5 text-gray-300">{orchestration.run.goal}</p>}
    <ul className="space-y-1">
      {orchestration.tasks.filter(task => task.required).map(task => <li key={task.id} className="flex items-start justify-between gap-3 text-[11px]">
        <span className="min-w-0 text-gray-200">{task.title} <span className="text-gray-500">· {task.ownerName}</span></span>
        <span className={'shrink-0 capitalize ' + (task.status === 'accepted' ? 'text-emerald-200' : 'text-amber-200')}>{task.status === 'accepted' ? 'done' : task.status.replace(/_/g, ' ')}</span>
      </li>)}
    </ul>
    <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"><span>Final checks</span><span className={'normal-case tracking-normal ' + (orchestration.finalValidation?.status === 'passed' ? 'text-emerald-200' : 'text-amber-200')}>{orchestration.finalValidation?.status ?? 'not recorded'}</span></div>
      {checks.length ? checks.map((group, index) => <div key={group.repository ?? index} className="mt-1.5 space-y-1">
        {group.repository && checks.length > 1 && <div className="text-[10px] font-semibold text-gray-300">{group.repository}</div>}
        {group.commands.map((command, commandIndex) => <div key={commandIndex} className="flex justify-between gap-3 text-[11px] text-gray-400"><span className="truncate">{command.script || command.display || 'Check'}</span><span className={commandPassed(command) ? 'text-emerald-200' : 'text-rose-200'}>{commandResult(command)}</span></div>)}
        {group.commands.length === 0 && <p className="text-[11px] text-gray-500">No checks were recorded.</p>}
        {group.missingScripts.length > 0 && <p className="text-[10px] text-amber-200">Not set up in this codebase: {group.missingScripts.join(', ')}</p>}
      </div>) : <p className="mt-1 text-[11px] text-gray-500">No final checks were recorded.</p>}
    </div>
    {openFindings.length > 0 && <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.05] px-3 py-2.5 text-[11px] text-amber-100">
      <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />{openFindings.length} open {openFindings.length === 1 ? 'finding' : 'findings'}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-100/80">{openFindings.map(finding => <li key={finding.id}>{finding.title ?? finding.instruction ?? finding.severity}{finding.path ? ' · ' + finding.path : ''}</li>)}</ul>
    </div>}
    <ReviewDiff projectId={projectId} runId={orchestration.run.id} branchName={orchestration.run.branchName} expanded={expandedDiff} onReady={onDiffReady} />
  </>;
};
