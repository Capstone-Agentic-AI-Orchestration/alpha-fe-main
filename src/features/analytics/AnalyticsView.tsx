import React from 'react';
import { useApp } from '@/app/AppContext';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  PieChart
} from 'lucide-react';

const metricCard = 'rounded-2xl border border-white/[0.07] bg-surface p-4';

export const AnalyticsView: React.FC = () => {
  const { analytics } = useApp();
  const maxRuns = Math.max(...analytics.runTimeline.map(item => item.runs), 1);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-canvas p-5 text-gray-300 select-none font-sans lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h1 className="text-base font-semibold tracking-tight text-white">Operational analytics</h1>
          <span className="font-mono text-[11px] text-gray-500">last 24 hours</span>
        </div>
        <span className="text-[11px] text-gray-500">Run health and delivery activity</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Runs in the last 24h</span><Activity className="h-3.5 w-3.5 text-gray-500" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">{analytics.totalRuns24h}</div>
          <p className="mt-1 text-[11px] text-gray-500">Accepted and completed agent work</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Success rate</span><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">{analytics.successRate}%</div>
          <p className="mt-1 text-[11px] text-emerald-300/80">Runs completed without failure</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Average run latency</span><Clock3 className="h-3.5 w-3.5 text-gray-500" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">{analytics.avgLatencyMs}ms</div>
          <p className="mt-1 text-[11px] text-gray-500">Mean duration of persisted runs</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-gray-400"><span>Runs tracked</span><Bot className="h-3.5 w-3.5 text-brand-300" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-white">{analytics.totalAgentRuns}</div>
          <p className="mt-1 text-[11px] text-gray-500">Across the active workspace</p>
        </div>
      </div>

      <section className="rounded-2xl border border-white/[0.07] bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xs font-semibold tracking-wide text-white">Run activity</h2><p className="mt-1 text-[11px] text-gray-500">Completed and failed runs by time window</p></div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-500" />Completed</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-400" />Failed</span></div>
        </div>
        <div className="mt-6 grid h-44 grid-cols-8 items-end gap-2 border-b border-white/[0.06] sm:gap-5">
          {analytics.runTimeline.length === 0 ? <div className="col-span-8 flex h-full items-center justify-center text-xs text-gray-500">No run telemetry has been recorded yet.</div> : analytics.runTimeline.map(item => (
            <div key={item.hour} className="group flex h-full flex-col items-center justify-end gap-2">
              <div className="text-[10px] text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">{item.runs} runs</div>
              <div className="flex w-full max-w-9 flex-col justify-end gap-0.5 overflow-hidden rounded-t">
                <div className="w-full rounded-t bg-rose-400/80" style={{ height: `${Math.max(item.failed ? 8 : 0, (item.failed / maxRuns) * 100)}%` }} title={`${item.failed} failed`} />
                <div className="w-full bg-brand-500 transition-colors group-hover:bg-brand-400" style={{ height: `${Math.max(item.completed ? 8 : 0, (item.completed / maxRuns) * 100)}%` }} title={`${item.completed} completed`} />
              </div>
              <span className="font-mono text-[10px] text-gray-500">{item.hour}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <div className="mb-3"><h2 className="text-xs font-semibold tracking-wide text-white">Agent activity</h2><p className="mt-1 text-[11px] text-gray-500">Runs and completion efficiency by persona</p></div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-surface">
            <div className="grid grid-cols-12 gap-3 border-b border-white/[0.06] px-4 py-2.5 text-[11px] text-gray-500"><div className="col-span-6">Agent</div><div className="col-span-3 text-right">Runs</div><div className="col-span-3 text-right">Efficiency</div></div>
            {analytics.agentBreakdown.length === 0 ? <div className="px-4 py-8 text-xs text-gray-500">No agent run telemetry has been recorded yet.</div> : analytics.agentBreakdown.map(item => (
              <div key={item.agentId} className="grid grid-cols-12 items-center gap-3 border-b border-white/[0.04] px-4 py-3.5 text-xs last:border-0 hover:bg-white/[0.025]">
                <div className="col-span-6 flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05] text-gray-400"><Bot className="h-3.5 w-3.5" /></span><span className="truncate font-medium text-gray-200">{item.agentName}</span></div>
                <div className="col-span-3 text-right text-gray-300">{item.runs}</div><div className="col-span-3 text-right font-medium text-emerald-300">{item.efficiency}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.07] bg-surface p-5 lg:col-span-4">
          <div><h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-white"><PieChart className="h-3.5 w-3.5 text-gray-400" />Model usage</h2><p className="mt-1 text-[11px] text-gray-500">Share of recorded invocations</p></div>
          <div className="mt-5 space-y-4">
            {analytics.modelBreakdown.length === 0 ? <div className="py-6 text-xs text-gray-500">No model invocations have been recorded yet.</div> : analytics.modelBreakdown.map(model => (
              <div key={model.modelName} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-gray-300">{model.modelName}</span><span className="flex-shrink-0 font-semibold text-white">{model.percentage}% <span className="font-normal text-gray-500">· {model.totalCalls} calls</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-brand-500" style={{ width: `${model.percentage}%` }} /></div></div>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-[11px] text-gray-500"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-600" /><span>Operational telemetry is scoped to the active workspace.</span></div>
        </section>
      </div>
    </div>
  );
};
