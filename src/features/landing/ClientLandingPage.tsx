import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import cosmoLogoUrl from '@/assets/cosmo-logo.png';
import cosmoWordmarkUrl from '@/assets/cosmo-wordmark.png';
import { clientLandingHref, clientPortalHref, publicInquiryHref, publicInquirySlug } from '@/features/ticketing/publicIntakeApi';
import '@/features/ticketing/publicClient/clientPublic.css';
import { GALAXY_BEATS, journeyStep, ZoomScene, type JourneyProgress } from './zoomScene';
import { LandingMenu } from './LandingMenu';
import './clientLanding.css';

function readSlug(): string {
  return typeof window === 'undefined' ? '' : publicInquirySlug(window.location);
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const HOW_IT_WORKS = 'client-how';

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia(REDUCED_MOTION).matches;
}

/** Very tall viewports and reduced motion get a flat page: no sticky scenes, everything shown at once. */
function isFlat(): boolean {
  return globalThis.innerHeight > 1600 || prefersReducedMotion();
}

function sectionElement(id: string) {
  return document.querySelector(`#${id}`);
}

function scrollToSection(id: string) {
  sectionElement(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

type Journey = JourneyProgress & { page: number; active: string };
const INITIAL: Journey = { hp: 0, ip: 0, wp: 0, pp: 0, cp: 0, flat: false, page: 0, active: 'client-intro' };

const sections = [
  { id: 'client-intro', label: 'Intro' },
  { id: 'client-idea', label: 'The idea' },
  { id: HOW_IT_WORKS, label: 'How it works' },
  { id: 'client-project', label: 'Your project' },
  { id: 'client-start', label: 'Start' },
];

const ideaWords = 'Tell us what you have in mind. We take it from there.'.split(' ');
const highlighted = new Set(['Tell', 'there.']);

const steps = [
  { title: 'Tell us', short: 'Start with what you want.', description: 'Describe your idea in your own words. No account is needed to send an inquiry, and a project manager reads every one.' },
  { title: 'Get your invitation', short: 'Access, when it is ready.', description: 'Your project manager follows up, then sends an email invitation. Follow it to verify your access and finish setup, or keep using your existing password.' },
  { title: 'See your project', short: 'Watch it come together.', description: 'Sign in to follow your project, see updates as they happen, and share your feedback in one place.' },
];

const captions = [
  { title: 'Then see it come together.', description: 'Every piece of your project, lighting up as it moves forward.' },
  { title: 'Your say, when it matters.', description: 'See what is waiting on you and reply to your project manager right there.' },
  { title: 'All in one place.', description: 'From the first message to the finished work.' },
];

/** Zoom-out lines shown over the canvas, each with the project-progress window it owns. */
const recap = [
  { text: <>Every detail you see,</>, range: [0.48, 0.58] },
  { text: <>every step you take,</>, range: [0.58, 0.67] },
  { text: <>every idea you bring,</>, range: [0.67, 0.76] },
  { text: <>starts with <b>one message.</b></>, range: [0.76, 0.86] },
];

/** Caption in focus, matching the galaxy's beats: lighting up, the message, then the face-on reveal. */
function captionIndex(pp: number): number {
  if (pp < GALAXY_BEATS.ask) return 0;
  return pp < GALAXY_BEATS.reveal ? 1 : 2;
}

function recapClass(pp: number, [from, to]: number[]): string {
  if (pp >= to) return 'is-past';
  return pp >= from ? 'is-on' : '';
}

function railClass(index: number, step: number): string {
  if (index === step) return 'is-on';
  return index < step ? 'is-done' : '';
}

/** "Zoom journey" landing: a scroll-driven camera dives into the client's project, then back out to the two doors. */
export default function ClientLandingPage() {
  const [slug, setSlug] = useState(readSlug);
  const [journey, setJourney] = useState<Journey>(INITIAL);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const indexRef = useRef<HTMLElement>(null);
  const journeyRef = useRef(journey);
  const pointerRef = useRef<[number, number]>([0, 0]);
  const home = clientLandingHref(slug);
  const inquiry = publicInquiryHref(slug);
  const clientSignIn = clientPortalHref(slug);

  useEffect(() => {
    const updateSlug = () => setSlug(readSlug());
    window.addEventListener('hashchange', updateSlug);
    window.addEventListener('popstate', updateSlug);
    return () => {
      window.removeEventListener('hashchange', updateSlug);
      window.removeEventListener('popstate', updateSlug);
    };
  }, []);

  // The section rail brightens while the page is scrolling, then settles back.
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      indexRef.current?.classList.add('is-awake');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => indexRef.current?.classList.remove('is-awake'), 1400);
    };
    document.addEventListener('scroll', wake, { capture: true, passive: true });
    return () => {
      document.removeEventListener('scroll', wake, { capture: true });
      window.clearTimeout(timer);
    };
  }, []);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const vh = globalThis.innerHeight || 800;
    const track = (name: string) => {
      const rect = root.querySelector(`[data-track="${name}"]`)?.getBoundingClientRect();
      return rect ? clamp(-rect.top / Math.max(1, rect.height - vh)) : 0;
    };
    let active = sections[0].id;
    sections.forEach(({ id }) => { if ((sectionElement(id)?.getBoundingClientRect().top ?? Infinity) < vh * 0.5) active = id; });
    const page = document.scrollingElement ?? document.documentElement;
    const next: Journey = {
      hp: track('hero'), ip: track('idea'), wp: track('how'), pp: track('project'),
      // How far the closing section has risen into view; the Cosmo lockup recedes behind it.
      cp: clamp((vh - (sectionElement('client-start')?.getBoundingClientRect().top ?? vh)) / vh),
      flat: isFlat(), page: clamp(page.scrollTop / Math.max(1, page.scrollHeight - vh)), active,
    };
    const previous = journeyRef.current;
    const same = (Object.keys(next) as (keyof Journey)[]).every(key => {
      const value = next[key];
      return typeof value === 'number' ? Math.abs((previous[key] as number) - value) < 0.002 : previous[key] === value;
    });
    if (!same) { journeyRef.current = next; setJourney(next); }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new ZoomScene(canvas, cosmoWordmarkUrl);
    const start = performance.now();
    let frame = 0, pending = 0;
    const drawStill = () => scene.draw(0, true, journeyRef.current, pointerRef.current);
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        measure();
        if (prefersReducedMotion()) drawStill();
      });
    };
    const loop = (now: number) => {
      if (prefersReducedMotion()) { drawStill(); frame = 0; return; }
      scene.draw((now - start) / 1000, false, journeyRef.current, pointerRef.current);
      frame = requestAnimationFrame(loop);
    };
    const motion = globalThis.matchMedia(REDUCED_MOTION);
    const restart = () => { cancelAnimationFrame(frame); measure(); frame = requestAnimationFrame(loop); };
    measure();
    frame = requestAnimationFrame(loop);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    globalThis.addEventListener('resize', onScroll);
    motion.addEventListener('change', restart);
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true });
      globalThis.removeEventListener('resize', onScroll);
      motion.removeEventListener('change', restart);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
    };
  }, [measure]);

  const { flat, hp, ip, wp, pp, active } = journey;
  const activeIndex = sections.findIndex(({ id }) => id === active);
  const litWords = flat ? ideaWords.length : Math.floor(clamp(ip * 1.9) * ideaWords.length);
  const step = flat ? -1 : journeyStep(wp);
  const caption = flat ? -1 : captionIndex(pp);
  const sectionClass = (base: string, id: string) => `${base}${flat || active === id ? ' is-in' : ''}`;
  const shown = (on: boolean) => flat || on ? ' is-on' : '';
  const heroStyle: CSSProperties = flat ? {} : { opacity: clamp((0.5 - hp) / 0.26), transform: `scale(${1 + clamp((hp - 0.2) / 0.3) * 0.08})` };
  const fadeOut = (until: number, width: number, progress: number): CSSProperties => flat ? {} : { opacity: clamp((until - progress) / width) };

  return <div
    ref={rootRef}
    className={`alpha-public client-landing ${flat ? 'is-flat' : 'is-immersive'}`}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse') return;
      pointerRef.current = [clamp(event.clientX / globalThis.innerWidth) - 0.5, clamp(event.clientY / globalThis.innerHeight) - 0.5];
    }}
    onPointerLeave={() => { pointerRef.current = [0, 0]; }}
  >
    <button className="public-skip" onClick={() => mainRef.current?.focus()}>Skip to content</button>
    <header className="cl-header">
      <a className="public-brand cl-brand" href={home}>
        <img src={cosmoLogoUrl} alt="Cosmo home" width="155" height="60" />
      </a>
      <LandingMenu home={home} inquiry={inquiry} clientSignIn={clientSignIn} onHowItWorks={() => scrollToSection(HOW_IT_WORKS)} />
    </header>
    <canvas ref={canvasRef} className="cl-canvas" aria-hidden="true" />
    <div className="cl-progress" style={{ transform: `scaleX(${journey.page})` }} aria-hidden="true" />
    <nav ref={indexRef} className="cl-index" aria-label="Sections">
      <ul className="cl-mono">
        {sections.map(({ id, label }, index) => <li key={id}><button type="button" className={railClass(index, activeIndex)} aria-current={active === id ? 'location' : undefined} onClick={() => scrollToSection(id)}>{label}</button></li>)}
      </ul>
      <span className="cl-index-track" aria-hidden="true"><i style={{ transform: `scaleY(${journey.page})` }} /></span>
    </nav>
    <div className="cl-recap" aria-hidden="true">
      {recap.map(({ text, range }) => <span key={range[0]} className={flat ? '' : recapClass(pp, range)}>{text}</span>)}
    </div>

    <div className="cl-layer">
      <main ref={mainRef} tabIndex={-1} className="public-main">
        <section id="client-intro" className="cl-hero" data-track="hero" aria-labelledby="client-hero-heading">
          <div className="cl-stick cl-hero-stick" style={heroStyle}>
            <div className="cl-shade" aria-hidden="true" />
            <div className="cl-hero-in public-container">
              <p className="cl-hero-aside">One place for the request. <span>One place to stay in the loop.</span></p>
              <h1 id="client-hero-heading"><span className="cl-line"><span>A clear start for</span></span><span className="cl-line"><span>your next project<span className="cl-accent">.</span></span></span></h1>
              <div className="cl-hero-row">
                <div className="cl-buttons">
                  <a className="public-button public-button-primary cl-arrow-button" href={inquiry}>Start a project inquiry <ArrowRight size={18} /></a>
                  <a className="public-button public-button-secondary" href={clientSignIn}>Client sign in</a>
                </div>
                <span className="cl-cue cl-mono">Scroll to dive in <ArrowDown size={14} /></span>
              </div>
            </div>
          </div>
        </section>

        <section id="client-idea" className={sectionClass('cl-idea', 'client-idea')} data-track="idea" aria-label="Our approach">
          <div className="cl-stick" style={fadeOut(0.9, 0.12, ip)}>
            <div className="cl-idea-in public-container">
              <span className="cl-eyebrow cl-mono cl-fade">The idea</span>
              <p className="cl-manifesto cl-fade">
                {ideaWords.map((word, index) => <span key={word} className={`cl-word${index < litWords ? ' is-on' : ''}${highlighted.has(word) ? ' is-accent' : ''}`}>{index < ideaWords.length - 1 ? `${word} ` : word}</span>)}
              </p>
              <div className="cl-assurances cl-mono cl-fade"><span>A project manager reviews every inquiry</span><span>Only invited clients can sign in</span><span>Your project stays private</span></div>
            </div>
          </div>
        </section>

        <section id={HOW_IT_WORKS} className={sectionClass('cl-how', HOW_IT_WORKS)} data-track="how" aria-labelledby="client-how-heading">
          <div className="cl-stick" style={fadeOut(0.94, 0.12, wp)}>
            <div className="cl-shade" aria-hidden="true" />
            <div className="cl-how-in public-container">
              <div className="cl-fade">
                <span className="cl-eyebrow cl-mono">How it works</span>
                <h2 id="client-how-heading">Three steps.<br /><span>Nothing to set up.</span></h2>
                <div className="cl-rail cl-mono" aria-hidden="true">
                  {steps.map(({ title }, index) => <span key={title} className={railClass(index, step)}><span>0{index + 1}</span><i /></span>)}
                </div>
              </div>
              <ol className="cl-steps cl-fade">
                {steps.map(({ title, short, description }, index) => <li key={title} className={`cl-step cl-pos-${index + 1}${shown(step === index)}`}>
                  <span className="cl-mono">Step 0{index + 1} of 03</span><h3>{title}</h3><p className="cl-step-short">{short}</p><p>{description}</p>
                </li>)}
              </ol>
            </div>
          </div>
        </section>

        <section id="client-project" className={sectionClass('cl-project', 'client-project')} data-track="project" aria-labelledby="client-project-heading">
          <div className="cl-stick" style={fadeOut(GALAXY_BEATS.pull + 0.02, 0.04, pp)}>
            <div className="cl-shade" aria-hidden="true" />
            <div className="cl-project-in public-container">
              <h2 id="client-project-heading" className="sr-only">Then see your project come together</h2>
              <div className="cl-project-copy cl-fade">
                <span className="cl-eyebrow cl-mono">Your project</span>
                <ol className="cl-captions">
                  {captions.map(({ title, description }, index) => <li key={title} className={`cl-caption${shown(caption === index)}`}><strong>{title}</strong><span>{description}</span></li>)}
                </ol>
                <div className="cl-rail cl-mono" aria-hidden="true">
                  {captions.map(({ title }, index) => <span key={title} className={railClass(index, caption)}><span>0{index + 1}</span><i /></span>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="client-start" className={sectionClass('cl-close public-container', 'client-start')} aria-labelledby="client-close-heading">
          <h2 id="client-close-heading" className="cl-fade">Ready when<br />you are<span className="cl-accent">.</span></h2>
          <p className="cl-fade">Every project starts as a spark. Tell us yours.</p>
          <div className="cl-doors cl-fade">
            <a className="cl-door cl-door-new" href={inquiry}>
              <span className="cl-mono">New here</span>
              <span className="cl-door-title">Start a project inquiry <span className="cl-door-arrow"><ArrowRight size={18} /></span></span>
              <span className="cl-door-copy">No account is needed to ask about a project.</span>
            </a>
            <a className="cl-door" href={clientSignIn}>
              <span className="cl-mono">Already invited</span>
              <span className="cl-door-title">Sign in to your requests <span className="cl-door-arrow"><ArrowRight size={18} /></span></span>
              <span className="cl-door-copy">An inquiry does not create an account or grant access. If your project manager invites you, follow the email to verify your access or continue with your existing password.</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="public-footer public-container">
        <span className="public-footer-brand">Alphaexplora <span>AI work, orchestrated.</span></span>
        <div className="cl-footer-end">
          <p>Only requests your project manager shares with you appear in your account.</p>
          <a className="public-text-link" href="/#/team">Team sign in <ArrowUpRight size={14} /></a>
        </div>
      </footer>
    </div>
  </div>;
}
