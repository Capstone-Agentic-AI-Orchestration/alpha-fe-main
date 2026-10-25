import { useApp, useTabSessionState } from '@/app/AppContext';
import { apiService } from '@/shared/services/apiService';
import { ProjectActionsView } from '@/features/projects/repository/ProjectActionsView';
import { useActionsResource } from '@/features/projects/repository/useActionsResource';
import { SectionEmpty, SectionError, SectionLoading } from '@/features/projects/repository/SectionState';
import { actionsInput } from '@/features/projects/repository/ActionsRunDetail';

/** The global Actions entry point uses the same viewer and an explicit project. */
export function DeploymentsActionsView() {
  const { projects, isActiveTab, activeWorkspaceId, identity, role } = useApp();
  const [projectId, setProject] = useTabSessionState('deployments.actionsProject', '');
  const project = projects.find(p => p.id === projectId);
  const repositories = useActionsResource(() => apiService.getProjectRepos(projectId), `${activeWorkspaceId}|${identity?.login}|${projectId}`,
    isActiveTab && Boolean(project));
  return <div className="space-y-4">
    <label className="block text-xs text-content-secondary">Project
      <select aria-label="Actions project" value={project?.id || ''} onChange={e => setProject(e.target.value)} className={`${actionsInput} mt-2 block max-w-full`}>
        <option value="">Choose a project</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
    {!project && <SectionEmpty>Choose a project to inspect its GitHub Actions. No repository is selected automatically.</SectionEmpty>}
    {project && repositories.error && <SectionError message={repositories.error} onRetry={repositories.reload} />}
    {project && repositories.loading && !repositories.data && <SectionLoading label="Loading project repositories…" />}
    {project && repositories.data && <ProjectActionsView key={`${activeWorkspaceId}|${identity?.login}|${projectId}`} projectId={projectId}
      repositories={repositories.data.repositories} repository={null} active={isActiveTab} canPromote={role === 'pm' || role === 'admin'} />}
  </div>;
}
