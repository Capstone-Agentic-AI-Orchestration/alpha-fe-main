import { useEffect, useRef, useState } from 'react';

interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global { interface Window { turnstile?: Turnstile } }
let providerScript: Promise<void> | null = null;
function loadProvider(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!providerScript) providerScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); providerScript = null; reject(new Error('Verification unavailable')); };
    document.head.appendChild(script);
  });
  return providerScript;
}

export function TicketInquiryVerification({ siteKey, slug, generation, onToken }: {
  siteKey: string; slug: string; generation: number; onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    setError('');
    onToken('');
    void loadProvider().then(() => {
      if (disposed || !container.current) return;
      if (!window.turnstile) throw new Error('Verification unavailable');
      widget = window.turnstile.render(container.current, { sitekey: siteKey, action: 'ticket_inquiry', cData: slug,
        callback: (value: string) => { if (!disposed) { setError(''); onToken(value); } },
        'expired-callback': () => { if (!disposed) { onToken(''); setError('Verification expired. Please verify again.'); } },
        'error-callback': () => { if (!disposed) { onToken(''); setError('Verification could not load. Please try again.'); } },
      });
    }).catch(() => { if (!disposed) { onToken(''); setError('Verification could not load. Please try again.'); } });
    return () => { disposed = true; if (widget !== undefined) window.turnstile?.remove(widget); };
  }, [siteKey, slug, generation, onToken, retry]);
  return <section aria-label="Submission verification"><div ref={container} />{error && <div className="mt-2 text-xs text-amber-200">
    <p role="alert">{error}</p><button type="button" className="mt-2 underline" onClick={() => setRetry(value => value + 1)}>Retry verification</button>
  </div>}</section>;
}
