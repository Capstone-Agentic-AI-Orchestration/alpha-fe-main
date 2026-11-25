import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useApp } from '@/app/AppContext';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { ATTENTION_GROUPS, type AttentionItem, type AttentionTarget } from './attentionItems';
import { useAttention } from './AttentionContext';

const GROUP_TONE: Record<AttentionItem['group'], string> = {
  approve: 'border-divider bg-selected text-selected-content',
  answer: 'border-status-warning-border bg-status-warning-subtle text-status-warning',
  review: 'border-status-success-border bg-status-success-subtle text-status-success',
};

function waited(since: string | undefined): string {
  const time = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'just now' : minutes + ' min ago';
  const hours = Math.round(minutes / 60);
  return hours < 24 ? hours + ' h ago' : Math.round(hours / 24) + ' d ago';
}

/** The page: what is waiting on you, grouped by what you do about it, each opening where you finish it. */
export const AttentionView: React.FC = () => {
  const { items, loading, incomplete, checkedAt, refresh } = useAttention();
  const { activeTabId, setTabSessionState, setActiveTab } = useApp();

  const open = (target: AttentionTarget) => {
    if (target.view === 'issues') {
      setTabSessionState(activeTabId, 'issues.project', target.projectId);
      if (target.issueId) setTabSessionState(activeTabId, 'issues.selectedIssue', target.issueId);
    }
    if (target.view === 'clients') setTabSessionState(activeTabId, 'clients.selected', target.clientKey);
    setActiveTab(target.view);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-content">Needs your attention</h1>
            <p className="text-xs text-content-muted">Everything waiting on you, across projects. Each item opens where you finish it.</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-content-muted">
            {checkedAt && <span>Checked {new Date(checkedAt).toLocaleTimeString()}</span>}
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} aria-hidden />Refresh
            </Button>
          </div>
        </header>

        {incomplete && <p role="status" className="text-xs text-status-warning">Some of your work could not be checked just now, so this list may be missing items.</p>}

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {ATTENTION_GROUPS.map(group => {
            const groupItems = items.filter(item => item.group === group.id);
            return (
              <Card key={group.id} className="overflow-hidden" aria-label={group.label}>
                <div className="flex items-center gap-2 border-b border-divider px-4 py-3">
                  <span className={'rounded-md border px-2 py-0.5 text-[11px] font-semibold ' + GROUP_TONE[group.id]}>{group.label}</span>
                  <span className="text-xs text-content-muted">{groupItems.length} waiting</span>
                </div>
                {groupItems.length ? groupItems.map(item => (
                  <div key={item.id} className="flex items-start gap-3 border-b border-divider px-4 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-content" title={item.title}>{item.title}</div>
                      <div className="truncate text-xs text-content-muted">{[item.detail, waited(item.since)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => open(item.target)}>{item.action}</Button>
                  </div>
                )) : <p className="px-4 py-4 text-xs text-content-muted">{loading && !checkedAt ? 'Checking…' : group.empty}</p>}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

