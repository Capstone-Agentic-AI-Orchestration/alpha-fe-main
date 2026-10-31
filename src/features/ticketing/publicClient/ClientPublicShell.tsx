import { useRef, type ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import cosmoLogoUrl from '@/assets/cosmo-logo.png';
import { clientLandingHref, clientPortalHref, publicInquiryHref } from '../publicIntakeApi';
import { CosmoBackdrop } from './CosmoBackdrop';
import { InteractiveBackdrop } from './InteractiveBackdrop';
import '../clientDesignTokens.css';
import './clientPublic.css';

export function ClientPublicShell({ children, page = 'landing', slug = '', navigationLocked = false, hasDraft = false }: {
  children: ReactNode;
  page?: 'landing' | 'inquiry' | 'access';
  slug?: string;
  navigationLocked?: boolean;
  hasDraft?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const homeHref = clientLandingHref(slug);
  const clientHref = clientPortalHref(slug);
  // Access pages (sign in, recovery, invitation setup) and the inquiry share the landing's
  // Cosmo space and fit one screen on desktop.
  const cosmo = page !== 'landing';
  return <div className={`alpha-public${cosmo ? ' public-cosmo public-fit' : ''}`} onClickCapture={event => {
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
    {cosmo ? <CosmoBackdrop /> : <InteractiveBackdrop />}
    <button className="public-skip" onClick={() => mainRef.current?.focus()}>Skip to content</button>
    <header className="public-header public-container">
      <a className="public-brand public-brand-cosmo" href={homeHref} onClick={event => { if (navigationLocked) event.preventDefault(); }} aria-disabled={navigationLocked || undefined}>
        <img src={cosmoLogoUrl} alt="Cosmo home" width="114" height="44" />
      </a>
      <nav className={`public-header-nav public-header-nav-${page}`} aria-label="Client navigation">
        {page === 'landing' ? <>
          <a className="public-current-page" href={homeHref} aria-current="page">Home</a>
          <a className="public-text-link" href={clientHref}>Client sign in</a>
          <button className="public-text-link public-how-link" onClick={() => document.getElementById('alpha-workflow')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>How it works</button>
          <a className="public-nav-action" href={publicInquiryHref(slug)}>Start an inquiry <ArrowUpRight size={15} /></a>
        </> : page === 'access' ? <>
          <a className="public-text-link" href={homeHref}>Home</a>
          <span className="public-current-page" aria-current="page">Client sign in</span>
          <a className="public-nav-action" href={publicInquiryHref(slug)}>Start an inquiry <ArrowUpRight size={15} /></a>
        </> : <>
          <a className="public-text-link" href={homeHref}>Home</a>
          <a className="public-text-link" href={clientHref} onClick={event => { if (navigationLocked) event.preventDefault(); }} aria-disabled={navigationLocked || undefined}>Client sign in</a>
          <span className="public-current-page" aria-current="page">Inquiry form</span>
        </>}
      </nav>
    </header>
    <main ref={mainRef} tabIndex={-1} className="public-main">{children}</main>
    <footer className="public-footer public-container">
      <span className="public-footer-brand">Alphaexplora <span>AI work, orchestrated.</span></span>
      <p>Only requests your project manager shares with you appear in your account.</p>
    </footer>
  </div>;
}
