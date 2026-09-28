import { useEffect, useRef, useState } from 'react';

import { apiService } from '@/shared/services/apiService';

/**
 * The GitHub repositories attached to a project, as `owner/name`.
 *
 * `refreshKey` should change when the project's resources do, so a repository
 * created a moment ago appears without reopening the project. A failed lookup
 * reads as "no repositories": the repository view is an addition to the
 * project page, and an API that cannot answer is no reason to put an error
 * banner over the board.
 */
export function useProjectRepos(projectId: string | null, refreshKey = ''): { repos: string[]; loading: boolean } {
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastProject = useRef<string | null>(null);

  useEffect(() => {
    // Another project's repositories must not linger while this one's load;
    // a refresh of the same project keeps them, so the view does not flicker.
    if (lastProject.current !== projectId) setRepos([]);
    lastProject.current = projectId;
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    apiService
      .getProjectRepos(projectId)
      .then(result => {
        if (!cancelled) setRepos(Array.isArray(result?.repositories) ? result.repositories : []);
      })
      .catch(() => {
        if (!cancelled) setRepos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return { repos, loading };
}
