import { ScrollText } from 'lucide-react';

import { apiService } from '@/shared/services/apiService';
import { PIPELINE_BRANCHES, type HostingPreviews } from '@/shared/types';
import { RepoLogs } from './deploymentLogs/RepoLogs';
import { RefreshButton, RepoSection, SectionEmpty, SectionError, SectionLoading } from './SectionState';
import { useRepoResource } from './useRepoResource';

export function RepoLogsTab({ projectId, repo, active }: Readonly<{ projectId: string; repo: string; active: boolean }>) {
  const hosted = useRepoResource<HostingPreviews>(
    () => apiService.getRepoHostingPreviews(projectId, repo),
    `${projectId}|${repo}|previews`
  );
  const branches = hosted.data?.previews
    .map(preview => preview.branch)
    .sort((a, b) => PIPELINE_BRANCHES.indexOf(a) - PIPELINE_BRANCHES.indexOf(b)) ?? [];

  if (branches.length > 0) return <RepoLogs projectId={projectId} repo={repo} branches={branches} active={active} />;

  const emptyMessage = hosted.data?.state === 'unavailable'
    ? (hosted.data.error ?? 'Hosting is not available here.')
    : 'There are no logs yet. Set up hosting under Environment.';
  let content = <SectionEmpty>{emptyMessage}</SectionEmpty>;
  if (hosted.loading && !hosted.data) {
    content = <SectionLoading label="Loading logs" layout="code" rows={8} />;
  } else if (hosted.error) {
    content = <SectionError message={hosted.error} onRetry={hosted.reload} />;
  }

  return (
    <RepoSection
      id={`repo-logs-${repo}`}
      title="Logs"
      icon={<ScrollText className="h-3.5 w-3.5 text-link" aria-hidden />}
      actions={<RefreshButton onClick={hosted.reload} loading={hosted.loading} label="Refresh logs" />}
    >
      {content}
    </RepoSection>
  );
}
