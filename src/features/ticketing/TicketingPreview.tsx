import { useMemo, useState } from 'react';
import { ChevronDown, Edit3, FlaskConical, HelpCircle, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import { navIcon, navLabel, sectionsFor } from '@/config/navigation';
import type { PreviewRole } from './previewModel';
import { pmPreviewApi } from './ticketingPreviewFixtures';
import { clientPreviewApi } from './clientPreviewApi';
import ClientPortal from './ClientPortal';
import { PmTicketsView } from './PmTicketsView';

function isPmPreviewRole(value: PreviewRole): boolean {
  return value === 'pm';
}

/**
 * Development-only Alpha chrome around the real PM Tickets page. This keeps
 * the preview visually in Alpha without mounting AppProvider (which would
 * load workspace data and call the real API).
 */
function AlphaPmPreviewShell({ onViewAsClient, onReset }: { onViewAsClient: () => void; onReset: () => void }) {
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const expanded = pinnedOpen || hovered || focused;
  const sections = useMemo(() => sectionsFor('pm'), []);

  return <div className="flex h-dvh w-full overflow-hidden bg-background text-sm text-gray-100 font-sans">
    <div className="relative z-40 h-full w-[4.5rem] flex-shrink-0 overflow-visible">
      <aside aria-label="Alpha project manager navigation" aria-expanded={expanded}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        className={`absolute inset-y-0 left-0 flex h-full flex-col border-r border-white/[0.08] bg-shell/95 text-gray-300 backdrop-blur-xl transition-[width] duration-200 ${expanded ? 'w-64 shadow-[14px_0_36px_-28px_rgba(0,0,0,0.9)]' : 'w-[4.5rem]'}`}>
        <div className={`space-y-3 pb-3 pt-3 ${expanded ? 'px-3' : 'px-2'}`}>
          <div className={`flex items-center ${expanded ? 'gap-1' : 'flex-col gap-1'}`}>
            <div className={`flex min-w-0 items-center rounded-lg py-1.5 ${expanded ? 'flex-1 gap-2.5 px-2' : 'h-9 w-9 justify-center'}`} title="Alpha · demo workspace">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-white/[0.06] ring-1 ring-inset ring-white/[0.08]"><img src={alphaMarkUrl} alt="" className="h-7 w-6 object-contain" /></span>
              <span className={`min-w-0 truncate text-sm font-semibold text-white ${expanded ? 'block' : 'hidden'}`}>Northstar Demo</span>
              {expanded && <ChevronDown className="ml-auto h-4 w-4 flex-shrink-0 text-gray-500" />}
            </div>
            <button type="button" onClick={() => setPinnedOpen(value => !value)} aria-label={pinnedOpen ? 'Use hover to open sidebar' : 'Keep sidebar open'} aria-pressed={pinnedOpen}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-gray-200" title={pinnedOpen ? 'Use hover to open sidebar' : 'Keep sidebar open'}>
              {pinnedOpen ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          </div>
          <div className="space-y-1.5 pt-1">
            <button type="button" disabled aria-label="Search" title="Search · unavailable in preview" className={`flex rounded-lg text-gray-500 opacity-70 ${expanded ? 'w-full items-center justify-between px-3 py-2' : 'h-9 w-9 items-center justify-center'}`}>
              <span className={`flex items-center ${expanded ? 'gap-3' : ''}`}><Search className="h-4 w-4" /><span className={expanded ? 'block text-gray-400' : 'hidden'}>Search…</span></span>
              {expanded && <kbd className="text-[11px] text-gray-600">⌘ K</kbd>}
            </button>
            <button type="button" disabled aria-label="New Issue" title="Create an Issue in Alpha · unavailable in preview" className={`flex rounded-lg text-gray-500 opacity-70 ${expanded ? 'w-full items-center justify-between px-3 py-2' : 'h-9 w-9 items-center justify-center'}`}>
              <span className={`flex items-center ${expanded ? 'gap-3' : ''}`}><Edit3 className="h-4 w-4" /><span className={expanded ? 'block' : 'hidden'}>New Issue</span></span>
              {expanded && <kbd className="text-[11px] text-gray-600">C</kbd>}
            </button>
          </div>
        </div>
        <nav aria-label="Workspace pages" className={`no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto py-2 ${expanded ? 'px-2' : 'px-1.5'}`}>
          {sections.map(({ section, items }) => <div key={section.id} className="space-y-0.5 border-t border-white/[0.05] pt-3 first:border-t-0 first:pt-0">
            <div className={expanded ? 'mb-1 flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500' : 'sr-only'}>
              <span>{section.label}</span><span className="h-px flex-1 bg-white/[0.05]" aria-hidden="true" />
            </div>
            {items.map(item => {
              const active = item.id === 'tickets';
              return <button key={item.id} type="button" disabled={!active} aria-current={active ? 'page' : undefined}
                title={expanded ? undefined : navLabel(item.id, 'pm')}
                className={`group relative flex w-full items-center rounded-lg transition-colors ${expanded ? 'justify-between px-3 py-2' : 'justify-center px-0 py-2.5'} ${active ? 'bg-brand-500/15 font-semibold text-gray-100 ring-1 ring-inset ring-white/[0.06]' : 'cursor-not-allowed text-gray-600 opacity-70'}`}>
                <span className={`flex items-center ${expanded ? 'gap-3' : 'justify-center'} ${active ? 'text-brand-300' : 'text-gray-600'}`}>
                  {navIcon(item.id, 'h-4 w-4')}<span className={expanded ? 'block' : 'hidden'}>{navLabel(item.id, 'pm')}</span>
                </span>
              </button>;
            })}
          </div>)}
        </nav>
        <div className={`border-t border-white/[0.06] py-2.5 ${expanded ? 'px-3' : 'px-1.5'}`}>
          <div className={`flex items-center ${expanded ? 'gap-2.5 px-2 py-2' : 'flex-col gap-1'}`}>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-xs font-semibold text-gray-200">P</span>
            {expanded && <span className="min-w-0 flex-1"><span className="block truncate text-xs text-white">Demo PM</span><span className="block text-[11px] text-gray-500">Project Manager · Preview</span></span>}
          </div>
        </div>
        <div className={`border-t border-white/[0.06] py-2.5 text-xs text-gray-500 ${expanded ? 'px-4' : 'px-1.5'}`}>
          <div className={`flex items-center ${expanded ? 'justify-between' : 'flex-col gap-2'}`}><span className={`flex items-center gap-2 ${expanded ? '' : 'justify-center'}`}><HelpCircle className="h-4 w-4" /><span className={expanded ? 'block' : 'hidden'}>Prototype guide</span></span><span className="font-mono text-[10px] text-brand-400">{expanded ? 'v2.0.0' : '2.0'}</span></div>
        </div>
      </aside>
    </div>
    <div className="relative min-w-0 flex-1 overflow-hidden bg-shell">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-[1800px] flex-wrap items-center gap-1.5 rounded-2xl border border-white/[0.10] bg-surface-200/80 p-1.5 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
          <div role="tablist" aria-label="Open workspace tabs" className="workspace-tab-strip flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar">
            <div role="tab" aria-selected="true" className="flex h-9 min-w-[112px] max-w-[220px] items-center gap-2 rounded-xl border border-brand-400/30 bg-brand-500/15 px-3 text-xs font-medium text-white shadow-sm">
              <span className="text-brand-400">{navIcon('tickets', 'h-3.5 w-3.5')}</span><span className="truncate">Tickets</span>
            </div>
          </div>
          <button type="button" disabled title="Opening other Alpha pages is outside this preview" aria-label="Open new tab" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-600"><Plus className="h-4 w-4" /></button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            <span className="hidden items-center gap-1 text-[10px] text-amber-200/80 lg:flex"><FlaskConical className="h-3 w-3" />Local preview · sample data only</span>
            <button type="button" onClick={onViewAsClient} className="rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-gray-300 transition-colors hover:bg-white/[0.05]">View as Client</button>
            <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-gray-500 transition-colors hover:bg-white/[0.05] hover:text-gray-200"><Trash2 className="h-3 w-3" />Reset preview</button>
          </div>
        </div>
      </div>
      <main className="relative h-full overflow-hidden pt-16 sm:pt-20">
        <div className="h-full min-h-0">{/** The page body is the same PmTicketsView used by Alpha. */}
          {/* Kept visible so sample content cannot be mistaken for live records. */}
          <div className="flex h-full min-h-0 flex-col">
            <div className="mx-4 mt-1 flex items-center gap-2 rounded-md border border-amber-400/10 bg-amber-500/[0.035] px-3 py-1.5 text-[10px] text-amber-100/70"><FlaskConical size={12} />Fictional preview records · changes are disabled · nothing is sent to Alpha</div>
            <div className="min-h-0 flex-1"><PmTicketsView api={pmPreviewApi} /></div>
          </div>
        </div>
      </main>
    </div>
  </div>;
}

/** Both inspections render the real application page components, not alternate ticket layouts. */
export default function TicketingPreview({ initialRole }: { initialRole: PreviewRole }) {
  const [role, setRole] = useState(initialRole);
  if (isPmPreviewRole(role)) return <AlphaPmPreviewShell onViewAsClient={() => setRole('client')} onReset={() => window.location.reload()} />;
  return <div className="min-h-dvh bg-canvas">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/15 bg-amber-500/[0.04] px-4 py-2 text-[11px] text-amber-100/80">
      <p className="flex items-center gap-2"><FlaskConical size={13} />Local UI inspection · fictional records, no real account or server writes</p>
      <div className="flex gap-3"><button type="button" onClick={() => setRole('pm')} className="text-brand-300 hover:text-white">Project Manager</button><a href="/#/request" className="text-gray-300 hover:text-white">Inquiry form</a><a href="/#/client" className="text-gray-300 hover:text-white">Client access</a></div>
    </div>
    <ClientPortal api={clientPreviewApi} inspectionOnly />
  </div>;
}
