type Point = [number, number];
export interface WorkflowCurveConnection {
  id: string;
  start: Point;
  control1: Point;
  control2: Point;
  end: Point;
  /** A side corridor avoids the floating name and any preceding task rows. */
  viaX?: number;
  color: string;
  active: boolean;
  selected?: boolean;
  muted: boolean;
  feedback?: boolean;
  indicator?: 'PLAN' | 'CTX' | 'TASK';
}

export interface WorkflowSceneNode {
  id: string;
  center: Point;
  color: string;
  active: boolean;
  selected: boolean;
  kind?: 'task';
}

export function taskBranchGeometry(parent: { x: number; y: number; width: number }, leaf: { x: number; y: number }) {
  const direction = leaf.x < parent.x ? -1 : 1;
  const start: Point = [parent.x + direction * 24, parent.y - 40];
  const end: Point = [leaf.x, leaf.y - 15];
  const viaX = parent.x + direction * (leaf.y > 565 ? parent.width / 2 - 4 : 116);
  return { start, end, control1: start, control2: end, viaX };
}

export function workflowPathSegments(connection: WorkflowCurveConnection) {
  const { start, end, control1, control2, viaX } = connection;
  if (viaX === undefined) return [{ start, control1, control2, end }];
  const direction = viaX < start[0] ? -1 : 1;
  const exit: Point = [viaX, start[1] + 70];
  const entry: Point = [viaX, Math.max(exit[1] + 10, end[1] - 65)];
  return [
    { start, control1: [start[0] + direction * 50, start[1]] as Point, control2: [viaX, start[1]] as Point, end: exit },
    { start: exit, control1: [viaX, exit[1] + (entry[1] - exit[1]) / 3] as Point, control2: [viaX, entry[1] - (entry[1] - exit[1]) / 3] as Point, end: entry },
    { start: entry, control1: [viaX, entry[1] + 30] as Point, control2: [end[0], end[1] - 42] as Point, end },
  ];
}

/** The SVG fallback and WebGL renderer use the same curve definitions. */
export function workflowSvgPath(connection: WorkflowCurveConnection) {
  return `M ${connection.start.join(' ')} ${workflowPathSegments(connection).map(segment => `C ${segment.control1.join(' ')}, ${segment.control2.join(' ')}, ${segment.end.join(' ')}`).join(' ')}`;
}
