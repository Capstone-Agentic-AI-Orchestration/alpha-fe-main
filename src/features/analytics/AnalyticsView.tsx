import React from 'react';
import { useApp } from '@/app/AppContext';
import { 
  BarChart3, 
  Cpu, 
  DollarSign, 
  Zap, 
  ShieldCheck, 
  PieChart
} from 'lucide-react';

export const AnalyticsView: React.FC = () => {
  const { analytics } = useApp();

  const maxTokens = Math.max(...analytics.tokenTimeline.map(t => t.promptTokens + t.completionTokens), 1);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-canvas text-gray-300 p-6 space-y-6 select-none font-sans">
      
      {/* ================= TOP HEADER BAR ================= */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <h1 className="text-sm font-semibold text-white tracking-wide">Analytics</h1>
          <span className="text-xs text-gray-500 font-mono">24h telemetry</span>
        </div>

        <span className="text-[11px] text-gray-500">Values reported by the Alpha daemon</span>
      </div>

      {/* ================= 4 CLEAN KEY METRICS ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Token Volume */}
        <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Tokens (24h)</span>
            <Cpu className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {(analytics.totalTokens24h / 1_000_000).toFixed(2)}M
          </div>
          <div className="text-[11px] text-gray-400">
            Sum of reported input, output, cache, and thinking tokens
          </div>
        </div>

        {/* 2. Cloud Cost */}
        <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Cloud API Cost</span>
            <DollarSign className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            ${analytics.totalCost24h.toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-400">
            Sum of runtime-reported API-equivalent costs
          </div>
        </div>

        {/* 3. Latency */}
        <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Avg Agent Latency</span>
            <Zap className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {analytics.avgLatencyMs}ms
          </div>
          <div className="text-[11px] text-cyan-400">
            Mean run duration from persisted run timestamps
          </div>
        </div>

        {/* 4. Success Rate */}
        <div className="p-4 rounded-xl bg-surface border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Swarm Success Rate</span>
            <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {analytics.successRate}%
          </div>
          <div className="text-[11px] text-gray-400">
            {analytics.totalAgentRuns} runs recorded in the last 24 hours
          </div>
        </div>
      </div>

      {/* ================= TOKEN INGESTION TIMELINE ================= */}
      <div className="p-5 rounded-xl bg-surface border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-xs font-semibold text-white tracking-wide">Token Ingestion & Generation Velocity</h2>
            <p className="text-[11px] text-gray-400">Prompt vs completion token consumption across the day</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-gray-300">
              <span className="w-2 h-2 rounded-sm bg-brand-500" /> Prompt Tokens
            </span>
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2 h-2 rounded-sm bg-cyan-400" /> Completion Tokens
            </span>
          </div>
        </div>

        {/* Visual Graph Bars */}
        <div className="pt-5 pb-1 grid grid-cols-8 gap-3 sm:gap-6 items-end h-40 border-b border-white/5">
          {analytics.tokenTimeline.length === 0 ? (
            <div className="col-span-8 flex h-full items-center justify-center text-xs text-gray-500">
              No run telemetry has been recorded yet.
            </div>
          ) : analytics.tokenTimeline.map((item, idx) => {
            const promptHeight = (item.promptTokens / maxTokens) * 100;
            const compHeight = (item.completionTokens / maxTokens) * 100;

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="text-[10px] text-gray-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  ${item.cost.toFixed(2)}
                </div>
                <div className="w-full max-w-[32px] flex flex-col gap-0.5 rounded-t overflow-hidden">
                  <div 
                    className="w-full bg-cyan-400 hover:bg-cyan-300 transition-all rounded-t"
                    style={{ height: `${Math.max(4, compHeight)}%` }}
                    title={`Completion: ${item.completionTokens.toLocaleString()} tokens`}
                  />
                  <div 
                    className="w-full bg-brand-500 hover:bg-brand-400 transition-all"
                    style={{ height: `${Math.max(8, promptHeight)}%` }}
                    title={`Prompt: ${item.promptTokens.toLocaleString()} tokens`}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{item.hour}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 2-COLUMN BREAKDOWN: AGENT LEADERBOARD & MODEL SHARE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Agent Consumption Table (8 cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white tracking-wide">Agent Consumption Leaderboard</h2>
            <span className="text-[11px] text-gray-400">Ranked by token volume</span>
          </div>

          <div className="w-full">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-normal text-gray-400 border-b border-white/[0.04] items-center">
              <div className="col-span-5">Agent</div>
              <div className="col-span-2 text-center">Tasks</div>
              <div className="col-span-2 text-center">Efficiency</div>
              <div className="col-span-3 text-right">Tokens & Cost</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-white/[0.02]">
              {analytics.agentBreakdown.length === 0 ? (
                <div className="px-3 py-6 text-xs text-gray-500">No agent run telemetry has been recorded yet.</div>
              ) : analytics.agentBreakdown.map((item) => (
                <div 
                  key={item.agentId} 
                  className="grid grid-cols-12 gap-4 px-3 py-3.5 items-center text-xs hover:bg-white/[0.02] transition-colors"
                >
                  <div className="col-span-5 font-medium text-white truncate">
                    {item.agentName}
                  </div>
                  <div className="col-span-2 text-center text-gray-300">
                    {item.runs} runs
                  </div>
                  <div className="col-span-2 text-center font-medium text-emerald-400">
                    {item.efficiency}%
                  </div>
                  <div className="col-span-3 text-right">
                    <div className="text-white font-medium">{(item.tokens / 1000).toLocaleString()}k tokens</div>
                    <div className="text-gray-400 text-[11px]">${item.cost.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Model Invocations Share (4 cols) */}
        <div className="lg:col-span-4 p-5 rounded-xl bg-surface border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white flex items-center gap-1.5 tracking-wide">
              <PieChart className="w-3.5 h-3.5 text-gray-400" />
              <span>Model Invocations</span>
            </h2>
            <span className="text-[11px] text-gray-400">Share</span>
          </div>

          <div className="space-y-3 pt-1">
            {analytics.modelBreakdown.length === 0 ? (
              <div className="py-6 text-xs text-gray-500">No model invocations have been recorded yet.</div>
            ) : analytics.modelBreakdown.map((model) => (
              <div key={model.modelName} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 truncate max-w-[140px] text-[11px]">{model.modelName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-[11px]">${model.cost.toFixed(2)}</span>
                    <span className="text-white font-semibold text-[11px]">{model.percentage}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-canvas rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${model.cost === 0 ? 'bg-teal-400' : 'bg-brand-500'}`}
                    style={{ width: `${model.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5 text-teal-300">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Cost reported as $0
            </span>
            <span className="flex items-center gap-1.5 text-brand-300">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> Cost reported above $0
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
