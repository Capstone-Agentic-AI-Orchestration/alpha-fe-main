import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppWindow,
  Boxes,
  CircleAlert,
  Cog,
  Database,
  GitBranch,
  Github,
  Globe2,
  LoaderCircle,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { apiService, parseApiError } from '@/shared/services/apiService';
import type { ArchitectureEdge, ArchitectureNode, ArchitectureNodeKind, ArchitectureSection, RepoArchitecture } from '@/shared/types';

interface ArchitectureDiagramModalProps {
  projectId: string;
  repository: string;
  onClose: () => void;
}

type DiagramNode = ArchitectureNode & { x: number; y: number; sectionIndex: number; rank: number };
interface DiagramSection extends ArchitectureSection { x: number; y: number; width: number; height: number; count: number }
interface DiagramLayout { nodes: DiagramNode[]; sections: DiagramSection[]; width: number; height: number }

const NODE_WIDTH = 244;
const NODE_HEIGHT = 84;
const COLUMN_GAP = 20;
const ROW_GAP = 24;
const SECTION_GAP = 64;
const SECTION_HEADER_HEIGHT = 48;
const CANVAS_WIDTH = 1320;
const MIN_SECTION_WIDTH = 520;
const MAX_COLUMNS = 4;

const NODE_COLOR: Record<ArchitectureNodeKind, string> = {
  web: '#9b63ff',
  api: '#08c5f1',
  application: '#08c5f1',
  auth: '#18d7b0',
  database: '#438fff',
  jobs: '#a36bff',
  integration: '#14d1df',
  module: '#8794a8',
};

const NODE_ICON: Record<ArchitectureNodeKind, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  web: AppWindow,
  api: Server,
  application: Boxes,
  auth: ShieldCheck,
  database: Database,
  jobs: Cog,
  integration: Globe2,
  module: Boxes,
};

function fallbackSection(node: ArchitectureNode): ArchitectureSection {
  const evidence = `${node.label} ${node.details ?? ''} ${node.path ?? ''}`.toLowerCase();
  if (node.kind === 'web' || /frontend|front-end|browser|client|user interface/.test(evidence)) {
    return { id: 'frontend', label: 'Frontend', description: 'Browser app and user-facing components' };
  }
  if (/contract|shared|schema|types|protocol/.test(evidence)) return { id: 'contracts', label: 'Shared contracts', description: 'Payloads, schemas, and shared boundaries' };
  if (node.kind === 'auth') return { id: 'identity', label: 'Identity and access', description: 'Authentication and authorization' };
  if (node.kind === 'database' || node.kind === 'jobs') return { id: 'data-async', label: 'Data and async', description: 'Persistent stores, queues, and background work' };
  if (node.kind === 'integration') return { id: 'integrations', label: 'External integrations', description: 'Connected services and providers' };
  if (node.kind === 'api' || /backend|back-end|server|service|controller|route/.test(evidence)) {
    return { id: 'backend', label: 'Backend API', description: 'Request handling and domain services' };
  }
  return { id: 'application', label: 'Application components', description: 'Core modules and shared application logic' };
}

function placeNodes(diagram: RepoArchitecture): DiagramLayout {
  const declaredSections = diagram.sections ?? [];
  const declaredIds = new Set(declaredSections.map(section => section.id));
  const inferredSections = new Map<string, ArchitectureSection>();
  const normalizedNodes = diagram.nodes.map(node => {
    if (node.sectionId && declaredIds.has(node.sectionId)) return node;
    const section = fallbackSection(node);
    if (!declaredIds.has(section.id)) inferredSections.set(section.id, section);
    return { ...node, sectionId: section.id };
  });

  let sections = [
    ...declaredSections.filter(section => normalizedNodes.some(node => node.sectionId === section.id)),
    ...[...inferredSections.values()].filter(section => !declaredIds.has(section.id)),
  ];
  if (!sections.length && normalizedNodes.length) {
    sections = [{ id: 'system', label: 'System components', description: 'Repository components and their connections' }];
    for (const node of normalizedNodes) node.sectionId = 'system';
  }

  let y = 18;
  const placedSections: DiagramSection[] = [];
  const placedNodes: DiagramNode[] = [];
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]!;
    const group = normalizedNodes.filter(node => node.sectionId === section.id);
    const groupIds = new Set(group.map(node => node.id));
    const outgoing = new Map(group.map(node => [node.id, [] as string[]]));
    const incoming = new Map(group.map(node => [node.id, 0]));
    for (const edge of diagram.edges) {
      if (groupIds.has(edge.from) && groupIds.has(edge.to) && edge.from !== edge.to) {
        outgoing.get(edge.from)!.push(edge.to);
        incoming.set(edge.to, incoming.get(edge.to)! + 1);
      }
    }

    const ranks = new Map(group.map(node => [node.id, 0]));
    const queue = group.filter(node => incoming.get(node.id) === 0).map(node => node.id);
    const processed = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      if (processed.has(current)) continue;
      processed.add(current);
      for (const next of outgoing.get(current) ?? []) {
        ranks.set(next, Math.max(ranks.get(next) ?? 0, (ranks.get(current) ?? 0) + 1));
        incoming.set(next, incoming.get(next)! - 1);
        if (incoming.get(next) === 0) queue.push(next);
      }
    }

    const rankValues = [...new Set(group.map(node => ranks.get(node.id) ?? 0))].sort((a, b) => a - b);
    const rows: Array<{ rank: number; nodes: ArchitectureNode[] }> = [];
    const previousPositions = new Map<string, number>();
    for (const rank of rankValues) {
      const ranked = group.filter(node => ranks.get(node.id) === rank);
      if (rank > 0) {
        const score = (node: ArchitectureNode) => {
          const parents = diagram.edges.filter(edge => edge.to === node.id && groupIds.has(edge.from) && (ranks.get(edge.from) ?? 0) < rank);
          const positions = parents.map(edge => previousPositions.get(edge.from)).filter((value): value is number => value !== undefined);
          return positions.length ? positions.reduce((sum, value) => sum + value, 0) / positions.length : group.indexOf(node);
        };
        ranked.sort((a, b) => score(a) - score(b));
      }
      for (let offset = 0; offset < ranked.length; offset += MAX_COLUMNS) {
        const rowNodes = ranked.slice(offset, offset + MAX_COLUMNS);
        const rowIndex = rows.length;
        rows.push({ rank, nodes: rowNodes });
        rowNodes.forEach((node, column) => previousPositions.set(node.id, column + rowIndex * MAX_COLUMNS));
      }
    }

    const maxColumns = Math.max(1, ...rows.map(row => row.nodes.length));
    const gridWidth = maxColumns * NODE_WIDTH + (maxColumns - 1) * COLUMN_GAP;
    const sectionWidth = Math.min(CANVAS_WIDTH - 48, Math.max(MIN_SECTION_WIDTH, gridWidth + 56));
    const sectionX = (CANVAS_WIDTH - sectionWidth) / 2;
    const sectionHeight = SECTION_HEADER_HEIGHT + rows.length * NODE_HEIGHT + Math.max(0, rows.length - 1) * ROW_GAP + 18;
    placedSections.push({ ...section, x: sectionX, y, width: sectionWidth, height: sectionHeight, count: group.length });

    rows.forEach((row, rowIndex) => {
      const rowWidth = row.nodes.length * NODE_WIDTH + Math.max(0, row.nodes.length - 1) * COLUMN_GAP;
      const rowX = sectionX + (sectionWidth - rowWidth) / 2;
      row.nodes.forEach((node, column) => {
        placedNodes.push({
          ...node,
          sectionIndex,
          rank: row.rank,
          x: rowX + column * (NODE_WIDTH + COLUMN_GAP),
          y: y + SECTION_HEADER_HEIGHT + rowIndex * (NODE_HEIGHT + ROW_GAP),
        });
      });
    });
    y += sectionHeight + SECTION_GAP;
  }
  return { nodes: placedNodes, sections: placedSections, width: CANVAS_WIDTH, height: Math.max(520, y - SECTION_GAP + 20) };
}

function roundedOrthogonalPath(points: Array<{ x: number; y: number }>, radius = 9): string {
  if (points.length < 2) return '';
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const corner = points[index]!;
    const next = points[index + 1]!;
    if ((previous.x === corner.x && corner.x === next.x) || (previous.y === corner.y && corner.y === next.y)) {
      path += ` L ${corner.x} ${corner.y}`;
      continue;
    }
    const previousLength = Math.hypot(previous.x - corner.x, previous.y - corner.y);
    const nextLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const trim = Math.min(radius, previousLength / 2, nextLength / 2);
    const before = {
      x: corner.x + (previous.x - corner.x) * trim / previousLength,
      y: corner.y + (previous.y - corner.y) * trim / previousLength,
    };
    const after = {
      x: corner.x + (next.x - corner.x) * trim / nextLength,
      y: corner.y + (next.y - corner.y) * trim / nextLength,
    };
    path += ` L ${before.x} ${before.y} Q ${corner.x} ${corner.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1]!;
  return `${path} L ${last.x} ${last.y}`;
}

function ArchitectureGraph({ diagram }: { diagram: RepoArchitecture }) {
  const layout = useMemo(() => placeNodes(diagram), [diagram]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const matchingIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>();
    return new Set(layout.nodes.filter(node =>
      `${node.label} ${node.technology ?? ''} ${node.details ?? ''} ${node.path ?? ''} ${node.kind}`.toLowerCase().includes(normalizedQuery)
    ).map(node => node.id));
  }, [layout.nodes, normalizedQuery]);
  const byId = useMemo(() => new Map(layout.nodes.map(node => [node.id, node])), [layout.nodes]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (!viewport.clientWidth) return;
      setZoom(Math.min(1, Math.max(0.4, (viewport.clientWidth - 28) / layout.width)));
      observer.disconnect();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [layout.width]);

  const changeZoom = (amount: number) => setZoom(value => Math.min(1.5, Math.max(0.4, Math.round((value + amount) * 100) / 100)));
  const fitWidth = () => {
    const viewport = viewportRef.current;
    if (viewport) setZoom(Math.min(1, Math.max(0.4, (viewport.clientWidth - 28) / layout.width)));
  };
  const getEdgeRoute = (edge: ArchitectureEdge, index: number) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return null;
    if (from.sectionIndex !== to.sectionIndex) {
      const startX = from.x + NODE_WIDTH;
      const startY = from.y + NODE_HEIGHT / 2;
      const endX = to.x + NODE_WIDTH;
      const endY = to.y + NODE_HEIGHT / 2;
      const railX = layout.width - 18 - (index % 9) * 5;
      return {
        path: roundedOrthogonalPath([
          { x: startX, y: startY },
          { x: railX, y: startY },
          { x: railX, y: endY },
          { x: endX, y: endY },
        ]),
        labelX: railX - 58,
        labelY: (startY + endY) / 2,
      };
    }

    if (to.rank === from.rank + 1 && to.y > from.y + 2) {
      const startX = from.x + NODE_WIDTH / 2;
      const startY = from.y + NODE_HEIGHT;
      const endX = to.x + NODE_WIDTH / 2;
      const endY = to.y;
      const bendY = startY + Math.max(12, (endY - startY) / 2);
      return {
        path: roundedOrthogonalPath([
          { x: startX, y: startY },
          { x: startX, y: bendY },
          { x: endX, y: bendY },
          { x: endX, y: endY },
        ]),
        labelX: (startX + endX) / 2,
        labelY: bendY - 4,
      };
    }

    const section = layout.sections[from.sectionIndex]!;
    const startX = from.x + NODE_WIDTH;
    const startY = from.y + NODE_HEIGHT / 2;
    const endX = to.x + NODE_WIDTH;
    const endY = to.y + NODE_HEIGHT / 2;
    const railX = section.x + section.width - 10 - (index % 4) * 4;
    return {
      path: roundedOrthogonalPath([
        { x: startX, y: startY },
        { x: railX, y: startY },
        { x: railX, y: endY },
        { x: endX, y: endY },
      ]),
      labelX: railX - 58,
      labelY: (startY + endY) / 2,
    };
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-well">
      <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-surface px-4 py-3">
        <label className="relative min-w-[210px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Find a component or path"
            aria-label="Search architecture components"
            className="h-9 w-full rounded-lg border border-divider bg-well pl-9 pr-3 text-xs text-content outline-none transition focus:border-link"
          />
        </label>
        <span className="mr-auto text-xs text-content-secondary">
          {diagram.nodes.length} components <span className="text-content-muted">·</span> {diagram.sections?.length ?? layout.sections.length} sections
          {diagram.coverage && (
            <>
              <span className="text-content-muted"> · </span>
              <span title={`${diagram.coverage.repositoryFilesSeen.toLocaleString()} repository files indexed`}>
                {diagram.coverage.sourceFilesAnalyzed} of {diagram.coverage.inventoryTruncated ? 'at least ' : ''}{diagram.coverage.sourceFilesFound.toLocaleString()} source files analyzed
              </span>
            </>
          )}
        </span>
        {normalizedQuery && <span className="text-[11px] text-content-muted">{matchingIds.size} matches</span>}
        <div className="flex items-center gap-1 rounded-lg border border-divider bg-well p-0.5">
          <button type="button" onClick={() => changeZoom(-0.1)} aria-label="Zoom out" title="Zoom out" className="rounded-md p-1.5 text-content-secondary transition hover:bg-surface-raised hover:text-content"><Minus className="h-4 w-4" /></button>
          <span className="w-11 text-center text-[11px] tabular-nums text-content-secondary">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.1)} aria-label="Zoom in" title="Zoom in" className="rounded-md p-1.5 text-content-secondary transition hover:bg-surface-raised hover:text-content"><Plus className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={fitWidth} className="inline-flex h-9 items-center gap-2 rounded-lg border border-divider bg-well px-3 text-xs font-medium text-content-secondary transition hover:bg-surface-raised hover:text-content" title="Fit diagram to available width">
          <Maximize2 className="h-3.5 w-3.5" /> Fit width
        </button>
      </div>

      {selected && (
        <div className="flex items-start gap-3 border-b border-divider bg-surface-raised/70 px-5 py-3" aria-live="polite">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NODE_COLOR[selected.kind] }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-content">{selected.label}</span>
              <span className="rounded-md border border-divider px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-content-muted">{selected.kind}</span>
              <span className="text-[10px] text-content-muted">{layout.sections[selected.sectionIndex]?.label}</span>
              {selected.technology && <span className="text-xs text-content-secondary">{selected.technology}</span>}
            </div>
            {selected.details && <p className="mt-1 text-xs text-content-secondary">{selected.details}</p>}
            {selected.path && <p className="mt-1 truncate font-mono text-[10px] text-content-muted" title={selected.path}>{selected.path}</p>}
          </div>
          <button type="button" onClick={() => setSelectedId(null)} aria-label="Close component details" className="rounded-md p-1 text-content-muted transition hover:bg-surface hover:text-content"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-well p-3 sm:p-5">
        <svg
          width={Math.round(layout.width * zoom)}
          height={Math.round(layout.height * zoom)}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={`Architecture diagram with ${layout.sections.length} component sections for ${diagram.repository} on ${diagram.branch}`}
          className="mx-auto block max-w-none shrink-0"
          preserveAspectRatio="xMidYMin meet"
        >
          <defs>
            <pattern id="architecture-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1.1" cy="1.1" r="1" fill="rgb(var(--ui-control))" opacity=".44" />
            </pattern>
            <marker id="architecture-arrow" markerWidth="8" markerHeight="7" refX="7" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 Z" fill="rgb(var(--ui-text-muted))" />
            </marker>
          <style>{`
            @keyframes architecture-edge-flow { to { stroke-dashoffset: -100; } }
            .architecture-edge-flow { stroke: rgb(var(--ui-link)); stroke-width: 1.7; stroke-dasharray: 9 91; stroke-dashoffset: 0; opacity: .34; animation: architecture-edge-flow 4.8s linear infinite; }
            .architecture-edge-label { fill: rgb(var(--ui-text-secondary)); stroke: rgb(var(--ui-well)); stroke-width: 5px; stroke-linejoin: round; paint-order: stroke; font: 10px ui-sans-serif, system-ui, sans-serif; text-anchor: middle; }
            @media (prefers-reduced-motion: reduce) { .architecture-edge-flow { animation: none; stroke-dasharray: 4 9; opacity: .24; } }
          `}</style>
          </defs>
          <rect width={layout.width} height={layout.height} fill="url(#architecture-dots)" />

          {layout.sections.map(section => (
            <g key={section.id}>
              <rect x={section.x} y={section.y} width={section.width} height={section.height} rx="12" fill="rgb(var(--ui-surface))" fillOpacity=".82" stroke="rgb(var(--ui-divider))" strokeWidth="1" />
              <foreignObject x={section.x + 16} y={section.y + 7} width={section.width - 32} height="37">
                <div className="flex h-full min-w-0 items-start justify-between gap-3 overflow-hidden">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-link" />
                      <span className="truncate text-[11px] font-semibold tracking-[.06em] text-content">{section.label}</span>
                    </div>
                    {section.description && <span className="mt-0.5 block truncate pl-3.5 text-[10px] text-content-muted">{section.description}</span>}
                  </div>
                  <span className="shrink-0 rounded-md border border-divider bg-well/80 px-1.5 py-0.5 text-[10px] tabular-nums text-content-muted">{section.count}</span>
                </div>
              </foreignObject>
            </g>
          ))}

          {diagram.edges.map((edge, index) => {
            const route = getEdgeRoute(edge, index);
            if (!route) return null;
            const from = byId.get(edge.from)!;
            const to = byId.get(edge.to)!;
            const relatedToSearch = matchingIds.has(from.id) || matchingIds.has(to.id);
            const highlighted = selectedId === from.id || selectedId === to.id;
            return (
              <g key={`${edge.from}-${edge.to}-${index}`} opacity={normalizedQuery && !relatedToSearch ? 0.12 : 1}>
                <path
                  d={route.path}
                  fill="none"
                  stroke={highlighted ? 'rgb(var(--ui-link))' : 'rgb(var(--ui-text-muted))'}
                  strokeWidth={highlighted ? 2 : 1.4}
                  markerEnd="url(#architecture-arrow)"
                  opacity={highlighted ? 0.94 : 0.58}
                />
                <path
                  d={route.path}
                  pathLength="100"
                  fill="none"
                  className="architecture-edge-flow"
                  style={{ animationDelay: `${(index % 7) * 0.24}s`, opacity: highlighted ? 0.72 : 0.34 }}
                  pointerEvents="none"
                />
                {edge.label && edge.label.length <= 30 && (
                  <text className="architecture-edge-label" x={route.labelX} y={route.labelY}>
                    {edge.label}
                    <title>{edge.label}</title>
                  </text>
                )}
                <title>{edge.label || `${from.label} connects to ${to.label}`}</title>
              </g>
            );
          })}

          {layout.nodes.map(node => {
            const color = NODE_COLOR[node.kind];
            const Icon = NODE_ICON[node.kind];
            const isSelected = selectedId === node.id;
            const matches = !normalizedQuery || matchingIds.has(node.id);
            const metadata = node.technology || node.details || node.kind;
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${node.label}${node.technology ? `, ${node.technology}` : ''}`}
                onClick={() => setSelectedId(isSelected ? null : node.id)}
                onFocus={() => setSelectedId(node.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(isSelected ? null : node.id);
                  }
                }}
                className="cursor-pointer outline-none"
                opacity={matches ? 1 : 0.28}
              >
            <title>{`${node.label}${node.details ? `: ${node.details}` : ''}${node.path ? ` · ${node.path}` : ''}`}</title>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx="12"
                  fill={isSelected ? `${color}24` : 'rgb(var(--ui-surface-raised))'}
                  stroke={isSelected || (normalizedQuery && matches) ? color : 'rgb(var(--ui-divider))'}
                  strokeWidth={isSelected || (normalizedQuery && matches) ? 2 : 1.2}
                  className="transition-all duration-200"
                />
                <circle cx={node.x + 34} cy={node.y + NODE_HEIGHT / 2} r="19" fill={`${color}18`} stroke={`${color}65`} strokeWidth="1" />
                <foreignObject x={node.x + 19} y={node.y + NODE_HEIGHT / 2 - 15} width="30" height="30">
                  <div className="flex h-full items-center justify-center"><Icon className="h-[18px] w-[18px]" style={{ color }} /></div>
                </foreignObject>
                <foreignObject x={node.x + 64} y={node.y + 11} width={NODE_WIDTH - 76} height={NODE_HEIGHT - 18}>
                  <div className="flex h-full min-w-0 flex-col justify-center overflow-hidden">
                    <span className="block truncate text-[13px] font-semibold text-content">{node.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-content-secondary">{metadata}</span>
                    {node.path && <span className="mt-0.5 block truncate font-mono text-[9px] text-content-muted">{node.path}</span>}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
        {diagram.truncated && (
          <div className="sticky bottom-2 left-2 mt-2 w-max max-w-[94%] rounded-lg border border-status-warning-border bg-surface px-3 py-2 text-[11px] text-status-warning shadow-lg">
            Large repository: this diagram summarizes a broad sample across the repository. {diagram.coverage?.inventoryTruncated ? 'GitHub limited the file inventory, so some areas may be omitted.' : 'Related files are grouped into components to keep the view readable.'}
          </div>
        )}
      </div>
    </div>
  );
}

export const ArchitectureDiagramModal: React.FC<ArchitectureDiagramModalProps> = ({ projectId, repository, onClose }) => {
  const [diagram, setDiagram] = useState<RepoArchitecture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDiagram(null);
    apiService.getRepoArchitecture(projectId, repository)
      .then(result => { if (active) setDiagram(result); })
      .catch(err => { if (active) setError(parseApiError(err).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, repository, attempt]);

  const [owner, name] = repository.split('/');
  const headerMeta = diagram && (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-2 rounded-xl border border-divider bg-surface-raised px-2.5 py-1.5 text-content">
        <Github className="h-4 w-4" />
        <span>{owner}/{name}</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-divider bg-surface-raised px-2.5 py-1.5 text-status-info">
        <GitBranch className="h-4 w-4" />
        <span>{diagram.branch}</span>
      </span>
      <span className="rounded-xl border border-divider bg-surface-raised px-2.5 py-1.5 font-mono text-content-secondary" title={diagram.commit}>
        {diagram.commit.slice(0, 7)}
      </span>
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Architecture diagram"
      headerMeta={headerMeta}
      maxWidth="max-w-[1440px]"
      dialogClassName="h-[88vh]"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-well p-0"
    >
      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-well text-sm text-content-secondary" aria-live="polite">
          <LoaderCircle className="h-7 w-7 animate-spin text-link" />
          <span>Mapping repository sections and sampling their components…</span>
          <span className="text-xs text-content-muted">Large repositories can take a little longer to analyze.</span>
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-well px-6 text-center" role="alert">
          <CircleAlert className="h-8 w-8 text-status-danger" />
          <p className="max-w-xl text-sm text-content">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt(value => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-divider bg-surface-raised px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface-high"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      ) : diagram ? (
        <ArchitectureGraph diagram={diagram} />
      ) : null}
    </Modal>
  );
};
