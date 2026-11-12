import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

const ROBOT_VARIANTS = [
  { accent: 'brand', antenna: 'single', eyes: 'round', mouth: 'line' },
  { accent: 'cyan', antenna: 'bar', eyes: 'square', mouth: 'dot' },
  { accent: 'emerald', antenna: 'twin', eyes: 'triple', mouth: 'line' },
  { accent: 'amber', antenna: 'dome', eyes: 'smile', mouth: 'dot' },
  { accent: 'rose', antenna: 'single', eyes: 'triple', mouth: 'line' },
  { accent: 'violet', antenna: 'twin', eyes: 'round', mouth: 'smile' },
  { accent: 'gray', antenna: 'bar', eyes: 'square', mouth: 'line' },
  { accent: 'teal', antenna: 'single', eyes: 'smile', mouth: 'dot' },
  { accent: 'indigo', antenna: 'dome', eyes: 'wide', mouth: 'line' },
  { accent: 'blue', antenna: 'twin', eyes: 'triple', mouth: 'smile' },
] as const;

function robotIndex(agentId: string): number {
  // FNV-1a makes the illustration repeatable across screens and sessions.
  let hash = 0x811c9dc5;
  for (let index = 0; index < agentId.length; index += 1) {
    hash ^= agentId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % ROBOT_VARIANTS.length;
}

type Props = HTMLAttributes<HTMLSpanElement> & { agentId: string };

/** Original theme-aware robot art; variants are assigned by stable agent ID, never by role. */
export function AgentRobotAvatar({ agentId, className, ...props }: Props) {
  const variant = ROBOT_VARIANTS[robotIndex(agentId || 'alpha-agent')];
  const accent = `rgb(var(--c-${variant.accent}-400))`;
  const shell = `rgb(var(--c-${variant.accent}-900) / 0.62)`;
  const darker = `rgb(var(--c-${variant.accent}-950) / 0.92)`;
  const bright = 'rgb(var(--c-gray-100))';

  return (
    <span className={cn('inline-flex shrink-0', className)} aria-hidden="true" {...props}>
      <svg viewBox="0 0 48 48" className="h-full w-full" focusable="false">
        <circle cx="24" cy="24" r="22" fill="rgb(var(--c-surface))" stroke="rgb(var(--ui-divider))" />
        {variant.antenna === 'single' && <><path d="M24 8v5" stroke={accent} strokeWidth="2" strokeLinecap="round"/><circle cx="24" cy="6.5" r="2.5" fill={accent}/></>}
        {variant.antenna === 'bar' && <rect x="18" y="8" width="12" height="4" rx="2" fill={accent} />}
        {variant.antenna === 'dome' && <path d="M17 13a7 7 0 0 1 14 0" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />}
        {variant.antenna === 'twin' && <><path d="m17 13-3-5m17 5 3-5" stroke={accent} strokeWidth="2" strokeLinecap="round"/><circle cx="13" cy="7" r="2" fill={accent}/><circle cx="35" cy="7" r="2" fill={accent}/></>}
        <rect x="6.5" y="21" width="5" height="10" rx="2.5" fill={shell} stroke={accent} strokeOpacity=".56" />
        <rect x="36.5" y="21" width="5" height="10" rx="2.5" fill={shell} stroke={accent} strokeOpacity=".56" />
        <rect x="10" y="13" width="28" height="28" rx="9" fill={shell} stroke={accent} strokeWidth="1.35" />
        <path d="M15 16.5c2-1.4 5-2 8-2" fill="none" stroke={bright} strokeOpacity=".48" strokeWidth="1.2" strokeLinecap="round" />
        <rect x="14" y="21" width="20" height="12" rx="5" fill={darker} />
        {variant.eyes === 'round' && <><ellipse cx="20" cy="27" rx="2.3" ry="2.7" fill={bright}/><ellipse cx="28" cy="27" rx="2.3" ry="2.7" fill={bright}/></>}
        {variant.eyes === 'square' && <><rect x="17.5" y="24.5" width="4" height="5" rx="1.5" fill={bright}/><rect x="26.5" y="24.5" width="4" height="5" rx="1.5" fill={bright}/></>}
        {variant.eyes === 'triple' && <><circle cx="19" cy="27" r="1.6" fill={bright}/><circle cx="24" cy="27" r="1.6" fill={bright}/><circle cx="29" cy="27" r="1.6" fill={bright}/></>}
        {variant.eyes === 'smile' && <><path d="M17.5 27c1.5-2 3.3-2 4.8 0m5.4 0c1.5-2 3.3-2 4.8 0" fill="none" stroke={bright} strokeWidth="1.8" strokeLinecap="round"/></>}
        {variant.eyes === 'wide' && <><ellipse cx="20" cy="27" rx="2.9" ry="1.8" fill={bright}/><ellipse cx="28" cy="27" rx="2.9" ry="1.8" fill={bright}/></>}
        {variant.mouth === 'line' && <path d="M20 36h8" stroke={accent} strokeWidth="1.6" strokeLinecap="round"/>}
        {variant.mouth === 'dot' && <circle cx="24" cy="36" r="1.5" fill={accent}/>}
        {variant.mouth === 'smile' && <path d="M20 35c2.3 2 5.7 2 8 0" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>}
      </svg>
    </span>
  );
}
