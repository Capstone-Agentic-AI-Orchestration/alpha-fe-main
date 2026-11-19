import type { ReactNode } from 'react';
import { FolderKanban, House, ListChecks, Plus, type LucideIcon } from 'lucide-react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import type { ClientPage } from './clientWorkspaceTabs';

/** The three places a client goes. Project ideas live inside Requests. */
export type ClientNavPage = Exclude<ClientPage, 'proposals'>;
export const CLIENT_NAV: Array<{ id: ClientNavPage; label: string; Icon: LucideIcon }> = [
  { id: 'overview', label: 'Home', Icon: House },
  { id: 'projects', label: 'Projects', Icon: FolderKanban },
  { id: 'requests', label: 'Requests', Icon: ListChecks },
];

/** Requests stays highlighted while a project idea is open, since ideas are part of Requests. */
export function navPageFor(page: ClientPage): ClientNavPage {
  return page === 'proposals' ? 'requests' : page;
}

function NavCount({ count }: { count: number }) {
  return count > 0 ? <span className="cx-dot-count" aria-hidden="true">{count}</span> : null;
}

/**
 * Wide screens: brand, the three pages, New request, then refresh, notifications and the
 * account menu. Phones hide the page links here and use ClientTabBar at the bottom instead.
 */
export function ClientTopBar({ page, onNavigate, needsYou, newRequest, actions, account }: {
  page: ClientPage;
  onNavigate: (page: ClientNavPage) => void;
  /** Requests and project ideas waiting on the client, shown beside Requests. */
  needsYou: number;
  newRequest: ReactNode;
  actions: ReactNode;
  account: ReactNode;
}) {
  const current = navPageFor(page);
  return <header className="cx-topbar">
    <span className="cx-brand"><img src={alphaMarkUrl} alt="" aria-hidden="true" className="invert dark:invert-0" />Alphaexplora</span>
    <nav className="cx-nav" aria-label="Client portal pages">
      {CLIENT_NAV.map(({ id, label }) => <button key={id} type="button" aria-current={current === id ? 'page' : undefined}
        aria-label={id === 'requests' && needsYou ? label + ', ' + needsYou + ' need you' : undefined} onClick={() => onNavigate(id)}>
        {label}{id === 'requests' && <NavCount count={needsYou} />}
      </button>)}
    </nav>
    <div className="cx-topbar-actions">{newRequest}{actions}{account}</div>
  </header>;
}

/** Phones only (see clientKit.css): the same pages as a bottom tab bar, plus New request. */
export function ClientTabBar({ page, onNavigate, needsYou, newRequest }: {
  page: ClientPage; onNavigate: (page: ClientNavPage) => void; needsYou: number;
  /** Receives the tab-styled trigger, so the same New request menu opens from here. */
  newRequest: ((trigger: ReactNode) => ReactNode) | null;
}) {
  const current = navPageFor(page);
  return <nav className="cx-tabbar" aria-label="Client portal pages">
    {CLIENT_NAV.map(({ id, label, Icon }) => <button key={id} type="button" aria-current={current === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
      <Icon size={19} aria-hidden="true" />{label}{id === 'requests' && <NavCount count={needsYou} />}
    </button>)}
    {newRequest?.(<button type="button" className="cx-tab-new"><Plus size={20} aria-hidden="true" />New</button>)}
  </nav>;
}

