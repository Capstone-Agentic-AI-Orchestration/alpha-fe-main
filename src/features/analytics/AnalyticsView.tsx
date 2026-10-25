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

const metricCard = 'rounded-2xl border border-divider bg-surface p-4';

export const AnalyticsView: React.FC = () => {
  const { analytics } = useApp();
  const maxRuns = Math.max(...analytics.runTimeline.map(item => item.runs), 1);

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-canvas p-5 text-content-secondary select-none font-sans lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-content-secondary" />
          <h1 className="text-base font-semibold tracking-tight text-content">Operational analytics</h1>
          <span className="font-mono text-[11px] text-content-muted">last 24 hours</span>
        </div>
        <span className="text-[11px] text-content-muted">Run health and delivery activity</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-content-secondary"><span>Runs in the last 24h</span><Activity className="h-3.5 w-3.5 text-content-muted" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-content">{analytics.totalRuns24h}</div>
          <p className="mt-1 text-[11px] text-content-muted">Accepted and completed agent work</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-content-secondary"><span>Success rate</span><CheckCircle2 className="h-3.5 w-3.5 text-status-success" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-content">{analytics.successRate}%</div>
          <p className="mt-1 text-[11px] text-status-success">Runs completed without failure</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-content-secondary"><span>Average run latency</span><Clock3 className="h-3.5 w-3.5 text-content-muted" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-content">{analytics.avgLatencyMs}ms</div>
          <p className="mt-1 text-[11px] text-content-muted">Mean duration of persisted runs</p>
        </div>
        <div className={metricCard}>
          <div className="flex items-center justify-between text-xs text-content-secondary"><span>Runs tracked</span><Bot className="h-3.5 w-3.5 text-link" /></div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-content">{analytics.totalAgentRuns}</div>
          <p className="mt-1 text-[11px] text-content-muted">Across the active workspace</p>
        </div>
      </div>

      <section className="rounded-2xl border border-divider bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xs font-semibold tracking-wide text-content">Run activity</h2><p className="mt-1 text-[11px] text-content-muted">Completed and failed runs by time window</p></div>
          <div className="flex items-center gap-3 text-[11px] text-content-secondary"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-action" />Completed</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-400" />Failed</span></div>
        </div>
        <div className="mt-6 grid h-44 grid-cols-8 items-end gap-2 border-b border-divider sm:gap-5">
          {analytics.runTimeline.length === 0 ? <div className="col-span-8 flex h-full items-center justify-center text-xs text-content-muted">No run telemetry has been recorded yet.</div> : analytics.runTimeline.map(item => (
            <div key={item.hour} className="group flex h-full flex-col items-center justify-end gap-2">
              <div className="text-[10px] text-content-muted opacity-0 transition-opacity group-hover:opacity-100">{item.runs} runs</div>
              <div className="flex w-full max-w-9 flex-col justify-end gap-0.5 overflow-hidden rounded-t">
                <div className="w-full rounded-t bg-current text-status-danger" style={{ height: `${Math.max(item.failed ? 8 : 0, (item.failed / maxRuns) * 100)}%` }} title={`${item.failed} failed`} />
                <div className="w-full bg-action transition-colors group-hover:bg-action-hover" style={{ height: `${Math.max(item.completed ? 8 : 0, (item.completed / maxRuns) * 100)}%` }} title={`${item.completed} completed`} />
              </div>
              <span className="font-mono text-[10px] text-content-muted">{item.hour}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <div className="mb-3"><h2 className="text-xs font-semibold tracking-wide text-content">Agent activity</h2><p className="mt-1 text-[11px] text-content-muted">Runs and completion efficiency by persona</p></div>
          <div className="overflow-hidden rounded-2xl border border-divider bg-surface">
            <div className="grid grid-cols-12 gap-3 border-b border-divider px-4 py-2.5 text-[11px] text-content-muted"><div className="col-span-6">Agent</div><div className="col-span-3 text-right">Runs</div><div className="col-span-3 text-right">Efficiency</div></div>
            {analytics.agentBreakdown.length === 0 ? <div className="px-4 py-8 text-xs text-content-muted">No agent run telemetry has been recorded yet.</div> : analytics.agentBreakdown.map(item => (
              <div key={item.agentId} className="grid grid-cols-12 items-center gap-3 border-b border-divider px-4 py-3.5 text-xs last:border-0 hover:bg-surface-high">
                <div className="col-span-6 flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-raised text-content-secondary"><Bot className="h-3.5 w-3.5" /></span><span className="truncate font-medium text-content">{item.agentName}</span></div>
                <div className="col-span-3 text-right text-content-secondary">{item.runs}</div><div className="col-span-3 text-right font-medium text-status-success">{item.efficiency}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-divider bg-surface p-5 lg:col-span-4">
          <div><h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-content"><PieChart className="h-3.5 w-3.5 text-content-secondary" />Model usage</h2><p className="mt-1 text-[11px] text-content-muted">Share of recorded invocations</p></div>
          <div className="mt-5 space-y-4">
            {analytics.modelBreakdown.length === 0 ? <div className="py-6 text-xs text-content-muted">No model invocations have been recorded yet.</div> : analytics.modelBreakdown.map(model => (
              <div key={model.modelName} className="space-y-1.5"><div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-content-secondary">{model.modelName}</span><span className="flex-shrink-0 font-semibold text-content">{model.percentage}% <span className="font-normal text-content-muted">· {model.totalCalls} calls</span></span></div><div className="h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-action" style={{ width: `${model.percentage}%` }} /></div></div>
            ))}
          </div>
          <div className="mt-6 flex items-start gap-2 border-t border-divider pt-4 text-[11px] text-content-muted"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-content-muted" /><span>Operational telemetry is scoped to the active workspace.</span></div>
        </section>
      </div>
    </div>
  );
};
