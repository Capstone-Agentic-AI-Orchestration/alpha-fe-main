import React from 'react';
import { useApp } from '@/app/AppContext';
import { DocStatus, ProgressRing, SectionLabel } from '@/features/delivery/Ledger';
import { Plus, ArrowRight, MessageSquare, FileText } from 'lucide-react';
import { WorkspaceOverview } from '@/features/delivery/WorkspaceOverview';

export const ClientPortalView: React.FC = () => {
  const { currentUser, requirementDocs, projects, issues, setActiveTab, role } = useApp();
  if (role !== 'client') return <WorkspaceOverview />;

  const myDocs = requirementDocs.filter(doc => doc.clientId === currentUser.id);
  const awaitingMe = myDocs.filter(doc => doc.status === 'awaiting_client');
  const inFlight = myDocs.filter(doc => doc.status === 'approved' && doc.projectId);
  const firstName = currentUser.name.split(' ')[0];

  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8 lg:px-8">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold tracking-tight text-white">{firstName}, here is where things stand</h1>
            <p className="text-sm text-gray-500">{currentUser.company}</p>
          </div>
          <button onClick={() => setActiveTab('intake')} className="flex flex-shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-brand-600">
            <Plus className="h-4 w-4" /> New request
          </button>
        </div>

        {awaitingMe.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Waiting on you</SectionLabel>
            {awaitingMe.map(doc => (
              <button key={doc.id} onClick={() => setActiveTab('documents')} className="group w-full rounded-xl border border-brand-500/30 bg-surface p-5 text-left transition-colors hover:border-brand-500/60">
                <div className="flex items-start justify-between gap-5">
                  <div className="min-w-0 space-y-2">
                    <span className="font-mono text-[11px] text-gray-500">{doc.identifier}</span>
                    <p className="text-sm font-medium text-white">{doc.title}</p>
                    <p className="text-xs leading-relaxed text-gray-400">Your specification is ready. Review the requirements and confirm that the scope reflects what you need.</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-brand-400 transition-all group-hover:gap-2.5">Review specification <ArrowRight className="h-3.5 w-3.5" /></div>
                </div>
              </button>
            ))}
          </section>
        )}

        {inFlight.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Being built</SectionLabel>
            <div className="divide-y divide-white/[0.03]">
              {inFlight.map(doc => {
                const project = projects.find(item => item.id === doc.projectId);
                const projectIssues = issues.filter(issue => issue.projectId === doc.projectId);
                const done = projectIssues.filter(issue => issue.status === 'done').length;
                return (
                  <div key={doc.id} className="flex items-center gap-5 py-4">
                    <ProgressRing value={done} total={projectIssues.length || 1} tone="brand" size={30} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm text-gray-200">{project?.name || doc.title}</p>
                      <p className="font-mono text-[11px] tabular-nums text-gray-500">{done} of {projectIssues.length} items complete</p>
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
            <div className="space-y-4 py-12 text-center"><p className="text-sm text-gray-500">You have not sent us anything yet.</p><button onClick={() => setActiveTab('intake')} className="text-sm text-brand-400 transition-colors hover:text-brand-300">Describe what you need</button></div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {myDocs.map(doc => (
                <button key={doc.id} onClick={() => setActiveTab('documents')} className="flex w-full items-center gap-4 rounded px-2 py-3 text-left transition-colors hover:bg-white/[0.02]">
                  <FileText className="h-4 w-4 flex-shrink-0 text-gray-600" />
                  <span className="w-20 flex-shrink-0 font-mono text-[11px] text-gray-600">{doc.identifier}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-300">{doc.title}</span>
                  <span className="flex-shrink-0 text-[11px] text-gray-500">{doc.functionalRequirements.filter(item => item.included).length} requirements</span>
                  <DocStatus status={doc.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="pt-2">
          <button onClick={() => setActiveTab('chat')} className="flex items-center gap-2.5 text-sm text-gray-400 transition-colors hover:text-white"><MessageSquare className="h-4 w-4" />Message your project manager</button>
        </div>
      </div>
    </div>
  );
};
