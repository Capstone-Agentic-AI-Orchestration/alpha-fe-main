import React from 'react';
import { useApp, useTabSessionState } from '@/app/AppContext';
import { InboxNotification } from '@/shared/types';
import {
  Inbox,
  MoreHorizontal,
  Flame,
  Archive,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  GitBranch,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export const InboxView: React.FC = () => {
  const {
    inbox,
    handleApproval,
    markNotificationRead,
    archiveNotification,
    setActiveTab,
    runAgentOnIssue,
    prototypeRuns,
    retryPrototypeRun,
    can
  } = useApp();

  const canApprove = can('approve_runs');
  const canRunAgents = can('run_agents');

  const [selectedNotifId, setSelectedNotifId] = useTabSessionState<string | null>('inbox.selectedNotification', inbox[0]?.id || null);
  const [showArchived, setShowArchived] = useTabSessionState<boolean>('inbox.showArchived', false);

  const activeNotifications = inbox.filter(n => !n.archived);
  const archivedNotifications = inbox.filter(n => n.archived);

  const displayList = showArchived ? archivedNotifications : activeNotifications;
  const selectedNotif = inbox.find(n => n.id === selectedNotifId) || null;

  const getTimeAgo = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d`;
  };

  const getStatusIcon = (notif: InboxNotification) => {
    if (notif.type === 'agent_approval') {
      return <Clock className="w-4 h-4 text-status-warning" />;
    }
    if (notif.type === 'agent_failed') {
      return <XCircle className="w-4 h-4 text-status-danger" />;
    }
    if (notif.type === 'agent_completed') {
      return <CheckCircle2 className="w-4 h-4 text-status-success" />;
    }
    return <Clock className="w-4 h-4 text-content-muted" />;
  };

  return (
    <div className="h-full flex overflow-hidden bg-shell text-content text-sm">
      {/* Left Column: Notifications Feed (Spacious & Scaled) */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-divider bg-shell md:w-96">
        {/* Inbox Header */}
        <div className="h-14 px-5 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-content">
              {showArchived ? 'Archived Notifications' : 'Inbox'}
            </h2>
            {activeNotifications.length > 0 && !showArchived && (
              <span className="text-xs tabular-nums text-content-muted">
                {activeNotifications.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="p-1.5 rounded-lg text-content-secondary hover:text-content hover:bg-surface-high transition-colors text-xs font-medium"
              title={showArchived ? 'View Active Inbox' : 'View Archived'}
            >
              {showArchived ? 'Active Inbox' : <MoreHorizontal className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-divider">
          {displayList.length === 0 ? (
            <div className="p-10 text-center text-sm text-content-muted space-y-3">
              <Inbox className="w-10 h-10 mx-auto text-content-muted opacity-60" />
              <p>No notifications in {showArchived ? 'archive' : 'inbox'}.</p>
            </div>
          ) : (
            displayList.map((notif) => {
              const isSelected = selectedNotif?.id === notif.id;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    setSelectedNotifId(notif.id);
                    if (!notif.read) markNotificationRead(notif.id);
                  }}
                  className={`p-4 px-5 flex items-start gap-3.5 border-l-2 transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'border-divider bg-surface-raised'
                      : notif.read
                        ? 'border-transparent hover:bg-surface-high opacity-75'
                        : 'border-transparent hover:bg-surface-high'
                  }`}
                >
                  {/* Left Flame / Status Avatar */}
                  <div className="w-7 h-7 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                    <Flame className="w-4.5 h-4.5 text-status-warning fill-orange-400/20" />
                  </div>

                  {/* Middle Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-content truncate">
                        {notif.title}
                      </h4>
                      <span className="text-xs font-mono text-content-secondary flex-shrink-0">
                        {getTimeAgo(notif.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-content-secondary truncate leading-relaxed">
                      {notif.message}
                    </p>
                  </div>

                  {/* Right Status Dot */}
                  <div className="flex items-center justify-center flex-shrink-0 ml-1 pt-1.5">
                    {getStatusIcon(notif)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Archived Row */}
        {!showArchived && (
          <div
            onClick={() => setShowArchived(true)}
            className="p-4 px-5 border-t border-divider flex items-center justify-between text-sm text-content-secondary hover:text-content hover:bg-surface-high transition-colors cursor-pointer font-medium"
          >
            <div className="flex items-center gap-3">
              <Archive className="w-4.5 h-4.5 text-content-muted" />
              <span>Archived</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-content-muted">
              <span>{archivedNotifications.length}</span>
              <ChevronRight className="w-4 h-4 text-content-muted" />
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Notification Inspector / Empty State */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative bg-shell">
        {selectedNotif ? (
          <div className="max-w-3xl space-y-6 p-6 animate-fade-in md:p-8">
            {/* Top Row: Title + Author */}
            <div className="flex items-start justify-between gap-4 border-b border-divider pb-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-content-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    selectedNotif.type === 'agent_approval' ? 'bg-amber-400' :
                    selectedNotif.type === 'agent_failed' ? 'bg-rose-400' :
                    'bg-emerald-400'
                  }`} aria-hidden="true" />
                  <span className="font-medium capitalize text-content-secondary">
                    {selectedNotif.type.replace('_', ' ')}
                  </span>
                  <span>•</span>
                  <span className="text-content-secondary">{new Date(selectedNotif.timestamp).toLocaleString()}</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-content">
                  {selectedNotif.title}
                </h1>
                <p className="text-sm text-content-secondary leading-relaxed">
                  {selectedNotif.message}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => archiveNotification(selectedNotif.id)}
                  className="px-2 py-2 rounded-md hover:bg-surface-high text-content-secondary hover:text-content transition-colors text-xs font-medium flex items-center gap-2"
                  title="Archive Notification"
                >
                  <Archive className="w-4 h-4" />
                  <span>Archive</span>
                </button>
              </div>
            </div>

            {/* If Failure: Retry Task Button */}
            {selectedNotif.type === 'agent_failed' && (
              <div className="p-5 rounded-lg bg-status-danger-subtle border border-status-danger-border space-y-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-status-danger">
                  <AlertTriangle className="w-4.5 h-4.5" />
                  <span>Agent Execution Exception</span>
                </div>
                <p className="text-xs text-status-danger leading-relaxed font-mono">
                  {selectedNotif.message}
                </p>
                {canRunAgents && selectedNotif.entityType === 'issue' && selectedNotif.entityId && (
                  <button
                    onClick={() => {
                      const failedRun = prototypeRuns.find(run =>
                        run.issueId === selectedNotif.entityId && run.status === 'failed'
                      );
                      if (failedRun) retryPrototypeRun(failedRun.id);
                      else runAgentOnIssue(selectedNotif.entityId);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-on-accent text-xs font-semibold shadow-sm transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retry Agent Execution</span>
                  </button>
                )}
              </div>
            )}

            {/* Approval Diff Card (Human-in-the-Loop) */}
            {selectedNotif.type === 'agent_approval' && (
              <div className="py-5 border-y border-divider space-y-5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-status-info font-semibold">
                    <Bot className="w-4.5 h-4.5" />
                    <span>Agent Pull Request & Patch Review</span>
                  </div>
                </div>

                {/* Git branch & PR */}
                {selectedNotif.meta?.issueIdentifier && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-surface-raised border border-divider font-mono text-xs text-content-secondary">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-status-info" />
                      <span>{selectedNotif.meta.issueIdentifier}</span>
                    </div>
                  </div>
                )}

                {/* Diff Preview */}
                {selectedNotif.meta?.proposedChanges && (
                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-content-secondary tracking-wider">
                      Proposed Code Modifications
                    </label>
                    <pre className="p-4.5 rounded-xl bg-well border border-divider text-status-success font-mono text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap">
                      {selectedNotif.meta.proposedChanges}
                    </pre>
                  </div>
                )}

                {/* Approve / Reject Actions */}
                {canApprove && (!selectedNotif.approvalStatus || selectedNotif.approvalStatus === 'pending') ? (
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-divider">
                    <button
                      onClick={() => handleApproval(selectedNotif.id, 'rejected')}
                      className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-content-secondary transition-colors hover:text-status-danger"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Request changes</span>
                    </button>
                    <button
                      onClick={() => handleApproval(selectedNotif.id, 'approved')}
                      className="flex items-center gap-2 bg-emerald-500 px-6 py-2.5 text-xs font-semibold text-on-accent transition-colors hover:bg-emerald-600"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & validate</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 border-t border-divider pt-4 text-xs">
                    <span className={selectedNotif.approvalStatus === 'approved' ? 'text-status-success' : 'text-status-warning'}>
                      {selectedNotif.approvalStatus === 'approved' ? 'Approved · Preview validation started' : 'Changes requested'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab(selectedNotif.approvalStatus === 'approved' ? 'deployments' : 'issues')}
                      className="font-medium text-link hover:text-link-hover"
                    >
                      {selectedNotif.approvalStatus === 'approved' ? 'Open CI/CD →' : 'Return to issue →'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Related Issue Navigation */}
            {selectedNotif.entityType === 'issue' && (
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('issues')}
                  className="flex items-center gap-2 text-sm text-link hover:text-link-hover font-semibold transition-colors"
                >
                  <span>Go to related task tracker</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State Placeholder */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 text-content-muted select-none">
            <div className="w-20 h-20 rounded-2xl bg-surface/50 border border-divider flex items-center justify-center text-content-muted shadow-inner">
              <Inbox className="w-10 h-10" />
            </div>
            <p className="text-base font-medium text-content-secondary">
              Select a notification to view details
            </p>
          </div>
        )}

        {/* Floating Chat Bubble Button in bottom right */}
        <button
          onClick={() => setActiveTab('chat')}
          className="absolute bottom-8 right-8 w-12 h-12 rounded-full bg-surface hover:bg-surface-raised border border-divider text-content-secondary hover:text-content flex items-center justify-center shadow-2xl transition-all"
          title="Open Agent Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
