/** The sections of a project's workspace, one per tab, in the order they are shown. */
export const REPO_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'code', label: 'Code' },
  { id: 'pulls', label: 'Pull requests' },
  { id: 'runs', label: 'Pipeline runs' },
  { id: 'previews', label: 'Previews' },
  { id: 'logs', label: 'Logs' },
  { id: 'environment', label: 'Environment' }
] as const;

export type RepoTab = (typeof REPO_TABS)[number]['id'];

const IDS: readonly RepoTab[] = REPO_TABS.map(tab => tab.id);

export function isRepoTab(value: unknown): value is RepoTab {
  return typeof value === 'string' && (IDS as readonly string[]).includes(value);
}

/**
 * The tab a key moves to, following the WAI-ARIA tabs pattern: arrows step
 * and wrap around, Home and End jump to the ends. Null for any other key,
 * which is then left to the browser.
 */
export function tabForKey(current: RepoTab, key: string): RepoTab | null {
  const index = IDS.indexOf(current);
  switch (key) {
    case 'ArrowRight':
      return IDS[(index + 1) % IDS.length];
    case 'ArrowLeft':
      return IDS[(index - 1 + IDS.length) % IDS.length];
    case 'Home':
      return IDS[0];
    case 'End':
      return IDS[IDS.length - 1];
    default:
      return null;
  }
}
