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
import type { ArchitectureNode, ArchitectureNodeKind, RepoArchitecture } from '@/shared/types';

interface ArchitectureDiagramModalProps {
  projectId: string;
  repository: string;
  onClose: () => void;
}

type DiagramNode = ArchitectureNode & { x: number; y: number };

const NODE_WIDTH = 230;
const NODE_HEIGHT = 84;
const CANVAS_WIDTH = 1220;
const CANVAS_HEIGHT = 560;
const COLUMN_X: Record<number, number> = { 0: 48, 1: 344, 2: 644, 3: 944 };
const KIND_COLUMN: Record<ArchitectureNodeKind, number> = {
  web: 0,
  api: 1,
  application: 1,
  auth: 2,
  database: 2,
  jobs: 2,
  integration: 3,
};
const NODE_COLOR: Record<ArchitectureNodeKind, string> = {
  web: '#9b63ff',
  api: '#08c5f1',
  application: '#08c5f1',
  auth: '#18d7b0',
  database: '#438fff',
  jobs: '#a36bff',
  integration: '#14d1df',
};
const NODE_ICON: Record<ArchitectureNodeKind, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  web: AppWindow,
  api: Server,
  application: Boxes,
  auth: ShieldCheck,
  database: Database,
  jobs: Cog,
  integration: Globe2,
};

function placeNodes(nodes: ArchitectureNode[]): DiagramNode[] {
  const groups = new Map<number, ArchitectureNode[]>();
  for (const node of nodes) {
    const column = KIND_COLUMN[node.kind];
    groups.set(column, [...(groups.get(column) ?? []), node]);
  }

  return [...groups.entries()].flatMap(([column, group]) => {
    const rowGap = 42;
    const totalHeight = group.length * NODE_HEIGHT + Math.max(0, group.length - 1) * rowGap;
    const top = (CANVAS_HEIGHT - totalHeight) / 2;
    return group.map((node, index) => ({
      ...node,
      x: COLUMN_X[column]!,
      y: top + index * (NODE_HEIGHT + rowGap),
    }));
  });
}

function ArchitectureGraph({ diagram }: { diagram: RepoArchitecture }) {
  const nodes = placeNodes(diagram.nodes);
  const byId = new Map(nodes.map(node => [node.id, node]));

  return (
    <div className="relative flex min-h-0 flex-1 bg-[#080d14]">
      <svg
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        role="img"
        aria-label={`Architecture diagram for ${diagram.repository} on ${diagram.branch}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="architecture-dots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.1" cy="1.1" r="1" fill="#233043" opacity=".52" />
          </pattern>
          <marker id="architecture-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 Z" fill="#a8bddb" />
          </marker>
        </defs>
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#architecture-dots)" />

        {diagram.edges.map((edge, index) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const startX = from.x + NODE_WIDTH;
          const startY = from.y + NODE_HEIGHT / 2;
          const endX = to.x - 8;
          const endY = to.y + NODE_HEIGHT / 2;
          const bend = Math.max(34, (endX - startX) * 0.38);
          return (
            <path
              key={`${edge.from}-${edge.to}-${index}`}
              d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`}
              fill="none"
              stroke="#9cb1d0"
              strokeWidth="2.2"
              markerEnd="url(#architecture-arrow)"
              opacity=".92"
            />
          );
        })}

        {nodes.map(node => {
          const color = NODE_COLOR[node.kind];
          const Icon = NODE_ICON[node.kind];
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="13"
                fill={`${color}0d`}
                stroke={color}
                strokeWidth="1.8"
              />
              <foreignObject x={node.x + 18} y={node.y + 23} width="42" height="40">
                <div className="flex h-full items-center justify-center">
                  <Icon className="h-8 w-8" style={{ color }} />
                </div>
              </foreignObject>
              <text x={node.x + 73} y={node.y + (node.technology ? 38 : 49)} fill="#f3f6fb" fontSize="18" fontWeight="600">
                {node.label}
              </text>
              {node.technology && (
                <text x={node.x + 73} y={node.y + 60} fill="#93a2b9" fontSize="12.5">
                  {node.technology}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {diagram.truncated && (
        <p className="absolute bottom-4 left-5 rounded-lg border border-amber-300/20 bg-black/50 px-3 py-2 text-[11px] text-amber-100/80">
          GitHub returned a partial file tree; this diagram may omit components.
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
      <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#101722] px-2.5 py-1.5 text-slate-100">
        <Github className="h-4 w-4" />
        <span>{owner}/{name}</span>
      </span>
      <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#101722] px-2.5 py-1.5 text-sky-300">
        <GitBranch className="h-4 w-4" />
        <span>{diagram.branch}</span>
      </span>
      <span className="rounded-xl border border-white/10 bg-[#101722] px-2.5 py-1.5 font-mono text-slate-400" title={diagram.commit}>
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
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080d14] p-0"
    >
      {loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#080d14] text-sm text-slate-300" aria-live="polite">
          <LoaderCircle className="h-7 w-7 animate-spin text-brand-400" />
          <span>Reading the current repository architecture…</span>
        </div>
      ) : error ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[#080d14] px-6 text-center" role="alert">
          <CircleAlert className="h-8 w-8 text-rose-300" />
          <p className="max-w-xl text-sm text-slate-200">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt(value => value + 1)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-white/10"
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
