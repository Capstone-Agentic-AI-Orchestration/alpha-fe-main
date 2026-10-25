import React, { useEffect, useState } from 'react';
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
  RefreshCw,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { apiService, parseApiError } from '@/shared/services/apiService';
import type { ArchitectureEdge, ArchitectureNode, ArchitectureNodeKind, RepoArchitecture } from '@/shared/types';

interface ArchitectureDiagramModalProps {
  projectId: string;
  repository: string;
  onClose: () => void;
}

type DiagramNode = ArchitectureNode & { x: number; y: number; column: number };

const NODE_WIDTH = 250;
const NODE_HEIGHT = 108;
const COLUMN_GAP = 60;
const ROW_GAP = 30;
const MARGIN_X = 52;
const MARGIN_Y = 34;
const MIN_CANVAS_WIDTH = 1180;
const MIN_CANVAS_HEIGHT = 560;

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

function placeNodes(nodes: ArchitectureNode[], edges: ArchitectureEdge[]) {
  const outgoing = new Map(nodes.map(node => [node.id, [] as string[]]));
  const incomingCount = new Map(nodes.map(node => [node.id, 0]));
  for (const edge of edges) {
    if (!outgoing.has(edge.from) || !incomingCount.has(edge.to)) continue;
    outgoing.get(edge.from)!.push(edge.to);
    incomingCount.set(edge.to, incomingCount.get(edge.to)! + 1);
  }

  const ranks = new Map<string, number>();
  const roots = [
    ...nodes.filter(node => incomingCount.get(node.id) === 0),
    ...nodes,
  ];
  for (const root of roots) {
    if (ranks.has(root.id)) continue;
    ranks.set(root.id, 0);
    const queue = [root.id];
    while (queue.length) {
      const current = queue.shift()!;
      const nextRank = ranks.get(current)! + 1;
      for (const next of outgoing.get(current) ?? []) {
        if (ranks.has(next)) continue;
        ranks.set(next, nextRank);
        queue.push(next);
      }
    }
  }

  const grouped = new Map<number, ArchitectureNode[]>();
  for (const node of nodes) {
    const column = ranks.get(node.id) ?? 0;
    grouped.set(column, [...(grouped.get(column) ?? []), node]);
  }
  const columns = [...grouped.keys()].sort((a, b) => a - b);
  const columnCount = Math.max(1, (columns.at(-1) ?? 0) + 1);
  const maxRows = Math.max(1, ...[...grouped.values()].map(group => group.length));
  const width = Math.max(
    MIN_CANVAS_WIDTH,
    MARGIN_X * 2 + columnCount * NODE_WIDTH + (columnCount - 1) * COLUMN_GAP,
  );
  const height = Math.max(
    MIN_CANVAS_HEIGHT,
    MARGIN_Y * 2 + maxRows * NODE_HEIGHT + (maxRows - 1) * ROW_GAP,
  );

  const placed: DiagramNode[] = [];
  for (const [column, group] of grouped) {
    const groupHeight = group.length * NODE_HEIGHT + Math.max(0, group.length - 1) * ROW_GAP;
    const top = Math.max(MARGIN_Y, (height - groupHeight) / 2);
    group.forEach((node, index) => {
      placed.push({
        ...node,
        column,
        x: MARGIN_X + column * (NODE_WIDTH + COLUMN_GAP),
        y: top + index * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }
  return { nodes: placed, width, height };
}

function ArchitectureGraph({ diagram }: { diagram: RepoArchitecture }) {
  const layout = placeNodes(diagram.nodes, diagram.edges);
  const byId = new Map(layout.nodes.map(node => [node.id, node]));

  return (
    <div className="relative flex min-h-0 flex-1 overflow-auto bg-well">
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={'0 0 ' + layout.width + ' ' + layout.height}
        role="img"
        aria-label={'Architecture diagram for ' + diagram.repository + ' on ' + diagram.branch}
        className="block max-w-none shrink-0"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="architecture-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.1" cy="1.1" r="1" fill="rgb(var(--ui-control))" opacity=".52" />
          </pattern>
          <marker id="architecture-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgb(var(--ui-text-muted))" />
          </marker>
        </defs>
        <rect width={layout.width} height={layout.height} fill="url(#architecture-dots)" />

        {diagram.edges.map((edge, index) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const forward = to.column > from.column ||
            (to.column === from.column && to.y >= from.y);
          const startX = forward ? from.x + NODE_WIDTH : from.x;
          const startY = from.y + NODE_HEIGHT / 2;
          const endX = forward ? to.x - 8 : to.x + NODE_WIDTH + 8;
          const endY = to.y + NODE_HEIGHT / 2;
          const bend = Math.max(34, Math.abs(endX - startX) * 0.38);
          const firstControl = forward ? startX + bend : startX - bend;
          const secondControl = forward ? endX - bend : endX + bend;
          return (
            <path
              key={edge.from + '-' + edge.to + '-' + index}
              d={'M ' + startX + ' ' + startY + ' C ' + firstControl + ' ' + startY + ', ' + secondControl + ' ' + endY + ', ' + endX + ' ' + endY}
              fill="none"
              stroke="rgb(var(--ui-text-muted))"
              strokeWidth="2.2"
              markerEnd="url(#architecture-arrow)"
              opacity=".92"
            />
          );
        })}

        {layout.nodes.map(node => {
          const color = NODE_COLOR[node.kind];
          const Icon = NODE_ICON[node.kind];
          const metadata = node.technology || node.details || 'Component';
          return (
            <g key={node.id}>
              <title>{node.label + (node.details ? ': ' + node.details : '')}</title>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="13"
                fill={color + '0d'}
                stroke={color}
                strokeWidth="1.8"
              />
              <foreignObject x={node.x + 17} y={node.y + 31} width="42" height="46">
                <div className="flex h-full items-center justify-center">
                  <Icon className="h-8 w-8" style={{ color }} />
                </div>
              </foreignObject>
              <foreignObject x={node.x + 72} y={node.y + 15} width={NODE_WIDTH - 86} height={NODE_HEIGHT - 24}>
                <div className="flex h-full flex-col justify-center overflow-hidden" title={node.label + ' — ' + metadata}>
                  <span className="block truncate text-[15px] font-semibold text-content">{node.label}</span>
                  <span className="mt-1 block truncate text-xs text-content-secondary">{metadata}</span>
                  {node.path && (
                    <span className="mt-1 block truncate font-mono text-[10px] text-content-muted">{node.path}</span>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      {diagram.truncated && (
        <p className="sticky bottom-4 left-4 mt-auto w-max max-w-[90%] rounded-lg border border-status-warning-border bg-well px-3 py-2 text-[11px] text-status-warning">
          Large repository: the diagram uses a representative source sample.
        </p>
      )}
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
      dialogClassName="h-[84vh]"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-well p-0"
    >
      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-well text-sm text-content-secondary" aria-live="polite">
          <LoaderCircle className="h-7 w-7 animate-spin text-link" />
          <span>Analyzing the current repository commit…</span>
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
