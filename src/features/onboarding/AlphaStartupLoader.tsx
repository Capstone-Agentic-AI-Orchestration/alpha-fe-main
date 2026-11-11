const markStyles = `
.alpha-loading-mark .mark { stroke: currentColor; stroke-width: 13; stroke-linecap: round; stroke-linejoin: round; }
.alpha-loading-mark .draw { stroke-dasharray: 1; stroke-dashoffset: 1; }
.alpha-loading-mark .left { animation: alpha-loader-left 6s cubic-bezier(.65,0,.25,1) infinite; }
.alpha-loading-mark .right { animation: alpha-loader-right 6s cubic-bezier(.65,0,.25,1) infinite; }
.alpha-loading-mark .base { animation: alpha-loader-base 6s cubic-bezier(.65,0,.25,1) infinite; }
.alpha-loading-mark .inner { animation: alpha-loader-inner 6s cubic-bezier(.65,0,.25,1) infinite; }
.alpha-loading-mark .orbit { animation: alpha-loader-orbit 6s cubic-bezier(.65,0,.25,1) infinite; }
.alpha-loading-mark .trail { animation: alpha-loader-trail 6s cubic-bezier(.22,.61,.36,1) infinite; }
.alpha-loading-mark .trail-2 { animation-delay: .14s; }
.alpha-loading-mark .trail-3 { animation-delay: .28s; }
@keyframes alpha-loader-left { 0%, 4% { stroke-dashoffset: 1; opacity: 0 } 25%, 76% { stroke-dashoffset: 0; opacity: 1 } 94%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@keyframes alpha-loader-right { 0%, 13% { stroke-dashoffset: 1; opacity: 0 } 34%, 76% { stroke-dashoffset: 0; opacity: 1 } 94%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@keyframes alpha-loader-base { 0%, 25% { stroke-dashoffset: 1; opacity: 0 } 42%, 76% { stroke-dashoffset: 0; opacity: 1 } 94%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@keyframes alpha-loader-inner { 0%, 31% { stroke-dashoffset: 1; opacity: 0 } 48%, 76% { stroke-dashoffset: 0; opacity: 1 } 94%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@keyframes alpha-loader-orbit { 0%, 37% { stroke-dashoffset: 1; opacity: 0 } 58%, 76% { stroke-dashoffset: 0; opacity: 1 } 96%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@keyframes alpha-loader-trail { 0%, 46% { stroke-dashoffset: 1; opacity: 0 } 59%, 76% { stroke-dashoffset: 0; opacity: 1 } 93%, 100% { stroke-dashoffset: -1; opacity: 0 } }
@media (prefers-reduced-motion: reduce) { .alpha-loading-mark .draw { animation: none; stroke-dashoffset: 0; opacity: 1; } }
`;

export function AlphaStartupLoader({ label, detail }: { label: string; detail?: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-canvas p-6">
      <div role="status">
        <span className="sr-only">{label}</span>
        <svg viewBox="0 0 297 332" fill="none" aria-hidden="true" className="alpha-loading-mark block w-24 max-w-full p-3 text-content">
          <style>{markStyles}</style>
          <g className="mark">
            <path className="draw left" pathLength={1} d="M53 242 L151 34" />
            <path className="draw right" pathLength={1} d="M151 34 L248 242" />
            <path className="draw base" pathLength={1} d="M248 242 L151 193 L53 242" />
            <path className="draw inner" pathLength={1} d="M105 188 L151 91 L196 188 L151 165 Z" />
            <path className="draw orbit" pathLength={1} d="M39 195 C8 112 46 42 120 22 M182 22 C256 42 294 112 263 195 M202 255 C178 267 151 270 125 263" />
            <path className="draw trail" pathLength={1} d="M117 229 L93 279" />
            <path className="draw trail trail-2" pathLength={1} d="M81 247 L56 296" />
            <path className="draw trail trail-3" pathLength={1} d="M47 260 L22 309" />
          </g>
        </svg>
        {detail && (
          <p className="absolute inset-x-6 top-[calc(50%+4.5rem)] mx-auto max-w-xs text-center text-xs leading-relaxed text-content-secondary">
            {detail}
          </p>
        )}
      </div>
    </main>
  );
}
