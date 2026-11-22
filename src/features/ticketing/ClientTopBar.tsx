import type { ReactNode } from 'react';
import { FolderKanban, House, type LucideIcon } from 'lucide-react';
import { BRAND_MARK, BRAND_NAME } from '@/brand/brand';
import { Button } from '@/shared/components/ui/button';
import type { ClientPage } from './clientWorkspaceTabs';

/** Project conversations own their requests, so only the two primary client destinations are in the top nav. */
export type ClientNavPage = Exclude<ClientPage, 'proposals' | 'requests'>;
export const CLIENT_NAV: Array<{ id: ClientNavPage; label: string; Icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', Icon: House },
  { id: 'projects', label: 'Projects', Icon: FolderKanban },
];

/** Secondary request and idea views remain reachable from Overview without competing with Projects. */
export function navPageFor(page: ClientPage): ClientNavPage {
  return page === 'projects' ? 'projects' : 'overview';
}

/** The public site's mark, drawn in light strokes; light themes invert it to dark. */
function Brand() {
  return <span className="cx-brand"><img src={BRAND_MARK.url} alt="" aria-hidden="true" className="invert dark:invert-0" />{BRAND_NAME}</span>;
}

function PageLinks({ page, onNavigate }: { page: ClientPage; onNavigate: (page: ClientNavPage) => void }) {
  const current = navPageFor(page);
  return <nav className="cx-nav" aria-label="Client portal pages">
    {CLIENT_NAV.map(({ id, label, Icon }) => <Button key={id} type="button" variant="ghost" aria-label={label} aria-current={current === id ? 'page' : undefined}
      onClick={() => onNavigate(id)} className={`cx-nav-item ${current === id ? 'is-current' : ''}`}>
      <Icon size={16} aria-hidden="true" /><span>{label}</span>
    </Button>)}
  </nav>;
}

/** Shadcn dashboard navigation in a compact top bar, matching the existing client shell. */
export function ClientTopBar({ page, onNavigate, newRequest, actions, account }: {
  page: ClientPage;
  onNavigate: (page: ClientNavPage) => void;
  newRequest: ReactNode;
  actions: ReactNode;
  account: ReactNode;
}) {
  return <header className="cx-topbar">
    <Brand />
    <PageLinks page={page} onNavigate={onNavigate} />
    <div className="cx-topbar-actions">{newRequest}{actions}{account}</div>
  </header>;
}
