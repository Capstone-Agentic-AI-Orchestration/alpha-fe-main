import { useRef, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { clientPortalHref, publicInquiryHref } from '../publicIntakeApi';
import { InteractiveBackdrop } from './InteractiveBackdrop';
import './clientPublic.css';

export function ClientPublicShell({ children, page = 'landing', slug = '', navigationLocked = false, hasDraft = false }: {
  children: ReactNode;
  page?: 'landing' | 'inquiry';
  slug?: string;
  navigationLocked?: boolean;
  hasDraft?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const clientHref = clientPortalHref(slug);
  return <div className="alpha-public" onClickCapture={event => {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    const destination = new URL(anchor.href, window.location.href);
    const sameDocument = destination.origin === window.location.origin && destination.pathname === window.location.pathname && destination.search === window.location.search;
    // Full-document exits use the form's native beforeunload guard once.
    const leavesCurrentHash = sameDocument && !event.ctrlKey && !event.metaKey && !event.shiftKey && anchor.target !== '_blank';
    if (navigationLocked || (hasDraft && leavesCurrentHash && !window.confirm('Leave this inquiry? Your unsent details will be lost.'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }}>
    <InteractiveBackdrop />
    <button className="public-skip" onClick={() => mainRef.current?.focus()}>Skip to content</button>
    <header className="public-header public-container">
      <a className="public-brand" href={clientHref} onClick={event => { if (navigationLocked) event.preventDefault(); }} aria-disabled={navigationLocked || undefined}>
        <img src={alphaMarkUrl} alt="" width="36" height="36" />
        <span>Alpha<span className="public-brand-label">{page === 'inquiry' ? 'Project inquiry' : 'Client portal'}</span></span>
      </a>
      <nav aria-label="Client navigation">
        {page === 'landing' ? <>
          <a className="public-text-link" href={clientHref}>Client sign in</a>
          <button className="public-text-link public-how-link" onClick={() => document.getElementById('alpha-workflow')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>How it works</button>
          <a className="public-nav-action" href={publicInquiryHref(slug)}>Start an inquiry <ArrowUpRight size={15} /></a>
        </> : <a className="public-text-link" href={clientHref} onClick={event => { if (navigationLocked) event.preventDefault(); }} aria-disabled={navigationLocked || undefined}>Client access <ArrowUpRight size={15} /></a>}
      </nav>
    </header>
    <main ref={mainRef} tabIndex={-1} className="public-main">{children}</main>
    <footer className="public-footer public-container">
      <span className="public-footer-brand">Alpha <span>AI work, coordinated.</span></span>
      <p>Client access is limited to tickets shared with your account.</p>
    </footer>
  </div>;
}
