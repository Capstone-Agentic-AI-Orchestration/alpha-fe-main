import { useEffect, useRef, useState } from 'react';

import { apiService, normalizeGitHubRepo } from '@/shared/services/apiService';

/** How long to wait before each re-ask while the server catches up. */
const CATCH_UP_DELAYS_MS = [750, 1500, 3000, 6000];

/**
 * The GitHub repositories attached to a project, as `owner/name`.
 *
 * `attached` is what the page itself holds for the project (resource URLs or
 * `owner/name`). A project update is applied to the page first and saved in
 * the background, so the first answer after attaching a repository can come
 * from before the save landed. While the server's list is missing something
 * the page has attached, this asks again a few times, backing off.
 *
 * A failed lookup reads as "no repositories": the repository view is an
 * addition to the project page, and an API that cannot answer is no reason to
 * put an error banner over the board.
 */
export function useProjectRepos(projectId: string | null, attached: string[] = []): { repos: string[]; loading: boolean } {
  const [repos, setRepos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastProject = useRef<string | null>(null);

  const expected = attached
    .map(value => normalizeGitHubRepo(value)?.toLowerCase())
    .filter((value): value is string => Boolean(value));
  const expectedKey = [...new Set(expected)].sort().join('|');

  useEffect(() => {
    // Another project's repositories must not linger while this one's load;
    // a refresh of the same project keeps them, so the view does not flicker.
    if (lastProject.current !== projectId) setRepos([]);
    lastProject.current = projectId;
    if (!projectId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wanted = expectedKey ? expectedKey.split('|') : [];

    const ask = (attempt: number) => {
      setLoading(true);
      apiService
        .getProjectRepos(projectId)
        .then(result => {
          if (cancelled) return;
          const answer = Array.isArray(result?.repositories) ? result.repositories : [];
          setRepos(answer);
          const known = new Set(answer.map(repo => repo.toLowerCase()));
          const behind = wanted.some(repo => !known.has(repo));
          if (behind && attempt < CATCH_UP_DELAYS_MS.length) {
            timer = setTimeout(() => ask(attempt + 1), CATCH_UP_DELAYS_MS[attempt]);
          }
        })
        .catch(() => {
          if (!cancelled) setRepos([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    ask(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, expectedKey]);

  return { repos, loading };
}
