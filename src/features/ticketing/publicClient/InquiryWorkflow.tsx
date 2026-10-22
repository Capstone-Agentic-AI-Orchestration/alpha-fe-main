import { useId, useRef, useState } from 'react';
import { ArrowRight, Check, FileText, Mail, MessageSquare, type LucideIcon } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const stages: { title: string; short: string; description: string; icon: LucideIcon }[] = [
  { title: 'Share your idea', short: 'Start with the outcome.', description: 'Describe what you want to build, who it is for, and what needs to change. An Alphaexplora account is not needed to send an inquiry.', icon: FileText },
  { title: 'Talk with your project manager', short: 'Make the next step clear.', description: 'A project manager reviews your inquiry and follows up to understand your goals, constraints, and timing before any work is scheduled.', icon: MessageSquare },
  { title: 'Receive an invitation', short: 'Access, when it is ready.', description: 'When your project manager invites you, follow the email to verify your access and finish setup. If you already have a password, keep using it. You will see only the requests shared with you.', icon: Mail },
  { title: 'Follow your requests', short: 'Keep the conversation together.', description: 'Sign in with your email and password to follow your requests, message your project manager, attach documents, and review the shared result. Forgot your password? You can request a password link any time.', icon: Check },
];

export function InquiryWorkflow() {
  const [selected, setSelected] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const detailId = useId();
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const line = ref.current?.querySelector('.public-workflow-active-line');
      if (line) gsap.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' });
      const icon = ref.current?.querySelector('.public-workflow-detail-icon');
      if (icon) gsap.from(icon, { scale: 0.92, duration: 0.2, ease: 'power2.out', clearProps: 'transform' });
    });
    return () => media.revert();
  }, { scope: ref, dependencies: [selected], revertOnUpdate: true });
  const Icon = stages[selected].icon;
  return <section id="alpha-workflow" ref={ref} className="public-workflow public-container" aria-labelledby="workflow-heading">
    <div className="public-section-intro"><h2 id="workflow-heading">A clear next step.<br /><span>At every stage.</span></h2><p>From the first conversation to your shared requests, here’s how client access works in Alphaexplora.</p></div>
    <div className="public-workflow-track">
      <svg className="public-workflow-connector" viewBox="0 0 1000 20" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10H1000" /><path className="public-workflow-active-line" d={`M0 10H${Math.max(16, selected * 333)}`} pathLength="1" strokeDasharray="1" /></svg>
      {stages.map((stage, index) => <button key={stage.title} type="button" className={`public-workflow-step ${selected === index ? 'is-selected' : ''}`} aria-pressed={selected === index} aria-controls={detailId} onClick={() => setSelected(index)}>
        <span className="public-step-number">0{index + 1}</span><strong>{stage.title}</strong><span>{stage.short}</span><ArrowRight size={16} className="public-step-arrow" />
      </button>)}
    </div>
    <div id={detailId} className="public-workflow-detail" aria-live="polite" aria-atomic="true"><div className="public-workflow-detail-icon"><Icon size={25} /></div><div><h3>{stages[selected].title}</h3><p>{stages[selected].description}</p></div><span className="public-workflow-caption">How Alphaexplora works</span></div>
  </section>;
}
