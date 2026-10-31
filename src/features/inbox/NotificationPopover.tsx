import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  Bell,
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  Inbox,
  MessageCircle,
  Rocket,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { useApp } from '@/app/AppContext';
import type { InboxNotification } from '@/shared/types';

interface PopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

function timeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'recently';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function notificationLabel(type: InboxNotification['type']): string {
  switch (type) {
    case 'agent_approval': return 'Review requested';
    case 'agent_failed': return 'Run needs attention';
    case 'agent_completed': return 'Run completed';
    case 'issue_assigned': return 'Task update';
    case 'mention': return 'Mention';
    case 'deployment_status': return 'Deployment update';
    case 'ops_incident': return 'Operations alert';
    default: return 'Notification';
  }
}

function NotificationTypeIcon({ type }: { type: InboxNotification['type'] }) {
  const className = 'h-4 w-4 flex-shrink-0';
  switch (type) {
    case 'agent_approval': return <Clock className={`${className} text-status-warning`} />;
    case 'agent_failed': return <XCircle className={`${className} text-status-danger`} />;
    case 'agent_completed': return <CheckCircle2 className={`${className} text-status-success`} />;
    case 'issue_assigned': return <CheckSquare className={`${className} text-link`} />;
    case 'mention': return <MessageCircle className={`${className} text-status-info`} />;
    case 'deployment_status': return <Rocket className={`${className} text-content-muted`} />;
    case 'ops_incident': return <AlertTriangle className={`${className} text-status-danger`} />;
    default: return <Bell className={`${className} text-content-muted`} />;
  }
}

function pullRequestUrl(notification: InboxNotification): string | null {
  if (notification.meta?.prUrl?.startsWith('https://')) return notification.meta.prUrl;
  return notification.message.match(/https:\/\/[^\s]+\/pull\/\d+/)?.[0] ?? null;
}

export const NotificationPopover: React.FC = () => {
  const {
    inbox,
    unreadInboxCount,
    markNotificationRead,
    markAllNotificationsRead,
    archiveNotification,
    handleApproval,
    setActiveTab,
    setNotificationPanelOpen,
    notificationPanelOpen,
    runAgentOnIssue,
    prototypeRuns,
    retryPrototypeRun,
    can,
  } = useApp();

  const [showArchived, setShowArchived] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canApprove = can('approve_runs');
  const canRunAgents = can('run_agents');

  const activeNotifications = useMemo(() => inbox.filter(item => !item.archived), [inbox]);
  const archivedNotifications = useMemo(() => inbox.filter(item => item.archived), [inbox]);
  const displayList = showArchived ? archivedNotifications : activeNotifications;
  const selectedNotification = displayList.find(item => item.id === selectedNotificationId) ?? displayList[0] ?? null;

  useEffect(() => {
    const updateWidth = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    if (!notificationPanelOpen) return;
    if (!displayList.some(item => item.id === selectedNotificationId)) {
      setSelectedNotificationId(displayList[0]?.id ?? null);
    }
  }, [notificationPanelOpen, displayList, selectedNotificationId]);

  useEffect(() => {
    if (!notificationPanelOpen) return;
    if (isNarrow) setMobileDetailOpen(false);
    requestAnimationFrame(() => panelRef.current?.focus());
  }, [notificationPanelOpen, isNarrow]);

  useLayoutEffect(() => {
    if (!notificationPanelOpen) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const edge = 12;
      const width = Math.min(640, Math.max(0, window.innerWidth - edge * 2));
      const left = Math.min(
        Math.max(edge, rect.right - width),
        window.innerWidth - width - edge,
      );
      const top = rect.bottom + 8;
      setPosition({
        top,
        left,
        width,
        maxHeight: Math.max(200, Math.min(680, window.innerHeight - top - edge)),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updatePosition) : null;
    if (observer && triggerRef.current) observer.observe(triggerRef.current);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      observer?.disconnect();
    };
  }, [notificationPanelOpen]);

  useEffect(() => {
    if (!notificationPanelOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setNotificationPanelOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setNotificationPanelOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationPanelOpen, setNotificationPanelOpen]);

  const selectNotification = (notification: InboxNotification) => {
    setSelectedNotificationId(notification.id);
    if (!notification.read) markNotificationRead(notification.id);
    if (isNarrow) setMobileDetailOpen(true);
  };

  const archiveSelected = () => {
    if (!selectedNotification || showArchived) return;
    const selectedIndex = displayList.findIndex(item => item.id === selectedNotification.id);
    const next = displayList[selectedIndex + 1] ?? displayList[selectedIndex - 1] ?? null;
    archiveNotification(selectedNotification.id);
    setSelectedNotificationId(next?.id ?? null);
  };

  const decideApproval = async (action: 'approved' | 'rejected') => {
    if (!selectedNotification) return;
    setProcessingApprovalId(selectedNotification.id);
    try {
      await handleApproval(selectedNotification.id, action);
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const openRelatedTask = () => {
    setNotificationPanelOpen(false);
    setActiveTab('issues');
  };

  const selectedPullRequestUrl = selectedNotification ? pullRequestUrl(selectedNotification) : null;
  const showMobileList = !isNarrow || !mobileDetailOpen;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setNotificationPanelOpen(open => !open)}
        className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-focus ${notificationPanelOpen ? 'bg-selected text-selected-content' : 'text-content-secondary hover:bg-surface-high hover:text-content'}`}
        title="Notifications"
        aria-label={unreadInboxCount > 0 ? `Notifications, ${unreadInboxCount} unread` : 'Notifications'}
        aria-expanded={notificationPanelOpen}
        aria-haspopup="dialog"
        aria-controls="alpha-notification-popover"
      >
        <Bell className="h-4 w-4" />
        {unreadInboxCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-status-warning px-1 text-[9px] font-semibold tabular-nums text-black ring-2 ring-surface">
            {unreadInboxCount > 99 ? '99+' : unreadInboxCount}
          </span>
        )}
      </button>

      {notificationPanelOpen && position && createPortal(
        <div
          ref={panelRef}
          id="alpha-notification-popover"
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
          tabIndex={-1}
          style={{
            top: position.top,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            minHeight: Math.min(288, position.maxHeight),
          }}
          className="app-no-drag fixed z-[65] flex flex-col overflow-hidden rounded-2xl border border-divider bg-surface text-content shadow-2xl outline-none animate-slide-up"
        >
          <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-divider px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="text-sm font-semibold text-content">Notifications</h2>
              {unreadInboxCount > 0 && (
                <span className="rounded-full bg-status-warning-subtle px-2 py-0.5 text-[10px] font-medium tabular-nums text-status-warning">
                  {unreadInboxCount} unread
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={markAllNotificationsRead}
                disabled={unreadInboxCount === 0}
                className="rounded-md px-2 py-1.5 text-[11px] font-medium text-content-secondary transition hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-default disabled:opacity-45"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => setNotificationPanelOpen(false)}
                className="rounded-md p-1.5 text-content-muted transition hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-focus"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {showMobileList && (
              <section className={`${isNarrow ? 'w-full' : 'w-[42%] min-w-[14rem] max-w-[17rem] flex-shrink-0 border-r border-divider'} flex min-h-0 flex-col`} aria-label="Notification list">
                <div role="group" aria-label="Notification views" className="flex flex-shrink-0 items-center gap-1 border-b border-divider px-3 py-2.5">
                  <button
                    type="button"
                    aria-pressed={!showArchived}
                    onClick={() => setShowArchived(false)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus ${!showArchived ? 'bg-selected text-selected-content' : 'text-content-muted hover:bg-surface-high hover:text-content-secondary'}`}
                  >
                    All <span className="ml-1 font-mono text-[10px] opacity-75">{activeNotifications.length}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={showArchived}
                    onClick={() => setShowArchived(true)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-focus ${showArchived ? 'bg-selected text-selected-content' : 'text-content-muted hover:bg-surface-high hover:text-content-secondary'}`}
                  >
                    Archived <span className="ml-1 font-mono text-[10px] opacity-75">{archivedNotifications.length}</span>
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {displayList.length === 0 ? (
                    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 px-5 text-center text-content-muted">
                      <Inbox className="h-8 w-8 opacity-50" />
                      <p className="text-xs">No notifications in {showArchived ? 'archive' : 'notifications'}.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-divider">
                      {displayList.map(notification => {
                        const isSelected = selectedNotification?.id === notification.id;
                        return (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => selectNotification(notification)}
                            aria-pressed={isSelected}
                            className={`flex w-full items-start gap-3 border-l-2 px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-4 ${isSelected ? 'border-link bg-selected/70' : 'border-transparent hover:bg-surface-high'} ${notification.read ? 'text-content-secondary' : 'text-content'}`}
                          >
                            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface-raised">
                              <NotificationTypeIcon type={notification.type} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className={`truncate text-xs ${notification.read ? 'font-medium' : 'font-semibold'}`}>{notification.title}</span>
                                <span className="flex-shrink-0 font-mono text-[10px] text-content-muted">{timeAgo(notification.timestamp)}</span>
                              </span>
                              <span className="mt-1 block truncate text-[11px] leading-4 text-content-muted">{notification.message}</span>
                              {!notification.read && <span className="mt-2 block h-1.5 w-1.5 rounded-full bg-status-warning" aria-label="Unread" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {(!isNarrow || mobileDetailOpen) && (
              <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Notification details">
                {selectedNotification ? (
                  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
                    {isNarrow && (
                      <button
                        type="button"
                        onClick={() => setMobileDetailOpen(false)}
                        className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-content-secondary transition hover:text-content focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to notifications
                      </button>
                    )}

                    <div className="flex items-start justify-between gap-3 border-b border-divider pb-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-content-muted">
                          <NotificationTypeIcon type={selectedNotification.type} />
                          <span>{notificationLabel(selectedNotification.type)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="normal-case tracking-normal">{new Date(selectedNotification.timestamp).toLocaleString()}</span>
                        </div>
                        <h3 className="text-base font-semibold leading-6 text-content">{selectedNotification.title}</h3>
                        <p className="mt-1.5 break-words text-xs leading-5 text-content-secondary">{selectedNotification.message}</p>
                      </div>
                      {!showArchived && (
                        <button
                          type="button"
                          onClick={archiveSelected}
                          title="Archive notification"
                          aria-label="Archive notification"
                          className="flex-shrink-0 rounded-lg p-2 text-content-muted transition hover:bg-surface-high hover:text-content focus:outline-none focus:ring-2 focus:ring-focus"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {selectedNotification.type === 'agent_failed' && (
                      <div className="mt-4 rounded-xl border border-status-danger-border bg-status-danger-subtle p-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-status-danger">
                          <AlertTriangle className="h-4 w-4" /> Run needs attention
                        </div>
                        <p className="mt-2 text-[11px] leading-5 text-status-danger">Open the related task for its agent activity and next steps.</p>
                        {canRunAgents && selectedNotification.entityType === 'issue' && selectedNotification.entityId && (
                          <button
                            type="button"
                            onClick={() => {
                              const failedRun = prototypeRuns.find(run => run.issueId === selectedNotification.entityId && run.status === 'failed');
                              if (failedRun) retryPrototypeRun(failedRun.id);
                              else runAgentOnIssue(selectedNotification.entityId);
                            }}
                            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-status-danger px-3 py-2 text-[11px] font-semibold text-on-accent transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-focus"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Retry agent run
                          </button>
                        )}
                      </div>
                    )}

                    {selectedNotification.type === 'agent_approval' && (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-status-info">
                          <Bot className="h-4 w-4" /> Agent review
                        </div>
                        {selectedNotification.meta?.issueIdentifier && (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-divider bg-surface-raised px-3 py-2.5 text-[11px]">
                            <span className="text-content-muted">Related task</span>
                            <span className="truncate font-mono text-content-secondary">{selectedNotification.meta.issueIdentifier}</span>
                          </div>
                        )}
                        {selectedPullRequestUrl && (
                          <a
                            href={selectedPullRequestUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-divider bg-surface-raised px-3 py-2 text-[11px] font-medium text-link transition hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-focus"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Open pull request
                          </a>
                        )}
                        {selectedNotification.meta?.proposedChanges && (
                          <div className="rounded-xl border border-divider bg-surface-raised p-3">
                            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">Change summary</h4>
                            <p className="mt-2 break-words font-mono text-[11px] leading-5 text-content-secondary">{selectedNotification.meta.proposedChanges}</p>
                          </div>
                        )}
                        {selectedNotification.audience === 'client' ? (
                          <div className="flex items-center justify-between gap-3 border-t border-divider pt-3 text-[11px]">
                            <span className="text-content-secondary">Scope review is ready</span>
                            <button
                              type="button"
                              onClick={() => {
                                setNotificationPanelOpen(false);
                                setActiveTab('portal');
                              }}
                              className="font-medium text-link hover:text-link-hover focus:outline-none focus:ring-2 focus:ring-focus"
                            >
                              Review request
                            </button>
                          </div>
                        ) : canApprove && (!selectedNotification.approvalStatus || selectedNotification.approvalStatus === 'pending') ? (
                          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-3">
                            <button
                              type="button"
                              onClick={() => void decideApproval('rejected')}
                              disabled={processingApprovalId === selectedNotification.id}
                              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-content-secondary transition hover:bg-surface-high hover:text-status-danger focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Request changes
                            </button>
                            <button
                              type="button"
                              onClick={() => void decideApproval('approved')}
                              disabled={processingApprovalId === selectedNotification.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-action px-3 py-2 text-[11px] font-semibold text-on-action transition hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-wait disabled:opacity-50"
                            >
                              {processingApprovalId === selectedNotification.id
                                ? <Clock className="h-3.5 w-3.5 animate-pulse" />
                                : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Approve & validate
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3 border-t border-divider pt-3 text-[11px]">
                            <span className={selectedNotification.approvalStatus === 'approved' ? 'text-status-success' : 'text-status-warning'}>
                              {selectedNotification.approvalStatus === 'approved' ? 'Approved · Preview validation started' : 'Changes requested'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setNotificationPanelOpen(false);
                                setActiveTab(selectedNotification.approvalStatus === 'approved' ? 'deployments' : 'issues');
                              }}
                              className="font-medium text-link hover:text-link-hover focus:outline-none focus:ring-2 focus:ring-focus"
                            >
                              {selectedNotification.approvalStatus === 'approved' ? 'Open CI/CD' : 'Open related task'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNotification.entityType === 'issue' && selectedNotification.type !== 'agent_approval' && selectedNotification.audience !== 'client' && (
                      <button
                        type="button"
                        onClick={openRelatedTask}
                        className="mt-4 inline-flex w-fit items-center gap-2 text-xs font-semibold text-link transition hover:text-link-hover focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Open related task <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {selectedNotification.entityType === 'ops_incident' && can('view_operations') && (
                      <button
                        type="button"
                        onClick={() => {
                          setNotificationPanelOpen(false);
                          setActiveTab('operations');
                        }}
                        className="mt-4 inline-flex w-fit items-center gap-2 text-xs font-semibold text-link transition hover:text-link-hover focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        Open Operations Center <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {selectedNotification.type !== 'agent_approval' && selectedNotification.entityType !== 'issue' && (
                      <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-content-muted">
                        <NotificationTypeIcon type={selectedNotification.type} />
                        {notificationLabel(selectedNotification.type)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-content-muted">
                    <Inbox className="h-9 w-9 opacity-50" />
                    <p className="text-xs">Select a notification to view details.</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
