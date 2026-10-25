import React from 'react';
import { useApp } from '@/app/AppContext';
import { DocStatus, ProgressRing, SectionLabel } from '@/features/delivery/Ledger';
import { Plus, ArrowRight, MessageSquare, FileText } from 'lucide-react';
import { WorkspaceOverview } from '@/features/delivery/WorkspaceOverview';

export const ClientPortalView: React.FC = () => {
  const { currentUser, requirementDocs, projects, issues, setActiveTab, role, visibleTabs } = useApp();
  if (role !== 'client') return <WorkspaceOverview />;

  const specificationsVisible = visibleTabs.includes('documents');
  const RequestRow = specificationsVisible ? 'button' : 'div';

  const myDocs = requirementDocs.filter(doc => doc.clientId === currentUser.id);
  const awaitingMe = myDocs.filter(doc => doc.status === 'awaiting_client');
  const inFlight = myDocs.filter(doc => doc.status === 'approved' && doc.projectId);
  const firstName = currentUser.name.split(' ')[0];

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8 lg:px-8">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight text-content">{firstName}, here is where things stand</h1>
            <p className="text-sm text-content-muted">{currentUser.company}</p>
          </div>
          <button onClick={() => setActiveTab('intake')} className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-action px-4 py-2 text-sm font-medium text-on-action transition-colors hover:bg-action-hover">
            <Plus className="h-4 w-4" /> New request
          </button>
        </div>

        {specificationsVisible && awaitingMe.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Waiting on you</SectionLabel>
            {awaitingMe.map(doc => (
              <button key={doc.id} onClick={() => setActiveTab('documents')} className="group w-full rounded-xl border border-divider bg-surface p-5 text-left transition-colors hover:border-divider">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0 space-y-2">
                    <span className="font-mono text-[11px] text-content-muted">{doc.identifier}</span>
                    <p className="text-sm font-medium text-content">{doc.title}</p>
                    <p className="text-xs leading-relaxed text-content-secondary">Your specification is ready. Review the requirements and confirm that the scope reflects what you need.</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-link transition-all group-hover:gap-2.5">Review specification <ArrowRight className="h-3.5 w-3.5" /></div>
                </div>
              </button>
            ))}
          </section>
        )}

        {inFlight.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Being built</SectionLabel>
            <div className="divide-y divide-divider">
              {inFlight.map(doc => {
                const project = projects.find(item => item.id === doc.projectId);
                const projectIssues = issues.filter(issue => issue.projectId === doc.projectId);
                const done = projectIssues.filter(issue => issue.status === 'done').length;
                return (
                  <div key={doc.id} className="flex items-center gap-5 py-4">
                    <ProgressRing value={done} total={projectIssues.length || 1} tone="brand" size={30} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm text-content">{project?.name || doc.title}</p>
                      <p className="font-mono text-[11px] tabular-nums text-content-muted">{done} of {projectIssues.length} items complete</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <SectionLabel>All requests</SectionLabel>
          {myDocs.length === 0 ? (
            <div className="space-y-4 py-12 text-center"><p className="text-sm text-content-muted">You have not sent us anything yet.</p><button onClick={() => setActiveTab('intake')} className="text-sm text-link transition-colors hover:text-link-hover">Describe what you need</button></div>
          ) : (
            <div className="divide-y divide-divider">
              {myDocs.map(doc => (
                <RequestRow key={doc.id} onClick={specificationsVisible ? () => setActiveTab('documents') : undefined} className={`flex w-full items-center gap-4 rounded px-2 py-3 text-left ${specificationsVisible ? 'transition-colors hover:bg-surface-high' : ''}`}>
                  <FileText className="h-4 w-4 flex-shrink-0 text-content-muted" />
                  <span className="w-20 flex-shrink-0 font-mono text-[11px] text-content-muted">{doc.identifier}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-content-secondary">{doc.title}</span>
                  <span className="flex-shrink-0 text-[11px] text-content-muted">{doc.functionalRequirements.filter(item => item.included).length} requirements</span>
                  <DocStatus status={doc.status} />
                </RequestRow>
              ))}
            </div>
          )}
        </section>

        <div className="pt-2">
          <button onClick={() => setActiveTab('chat')} className="flex items-center gap-2.5 text-sm text-content-secondary transition-colors hover:text-content"><MessageSquare className="h-4 w-4" />Message your project manager</button>
        </div>
      </div>
    </div>
  );
};
