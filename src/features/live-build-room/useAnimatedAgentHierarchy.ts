import { useEffect, useRef, useState } from 'react';
import type { layoutAgentHierarchy } from './agentWorkflowLayout';

type Layout = ReturnType<typeof layoutAgentHierarchy>;
type Geometry = { width: number; height: number; points: Record<string, [number, number]> };

function geometry(layout: Layout): Geometry {
  return { width: layout.width, height: layout.height, points: Object.fromEntries([
    ...layout.positionedCards.map(node => [`agent:${node.card.executionId}`, [node.x, node.y]]),
    ...layout.taskLeaves.map(leaf => [`task:${leaf.id}`, [leaf.x, leaf.y]]),
  ]) };
}

/** One layout clock drives labels, spheres, and path endpoints together. */
export function useAnimatedAgentHierarchy(target: Layout, reduceMotion: boolean): Layout {
  const next = geometry(target);
  const signature = JSON.stringify(next);
  const [display, setDisplay] = useState(next);
  const current = useRef(display);
  useEffect(() => {
    const destination: Geometry = JSON.parse(signature);
    if (reduceMotion) {
      current.current = destination;
      setDisplay(destination);
      return;
    }
    const start = current.current;
    if (JSON.stringify(start) === signature) return;
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 260);
      const ease = 1 - (1 - progress) ** 3;
      const lerp = (a: number, b: number) => a + (b - a) * ease;
      const points = Object.fromEntries(Object.entries(destination.points).map(([id, end]) => {
        const from = start.points[id] ?? end;
        return [id, [lerp(from[0], end[0]), lerp(from[1], end[1])] as [number, number]];
      }));
      const value = { width: lerp(start.width, destination.width), height: lerp(start.height, destination.height), points };
      current.current = value;
      setDisplay(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [signature, reduceMotion]);
  return {
    width: display.width,
    height: display.height,
    positionedCards: target.positionedCards.map(node => {
      const [x, y] = display.points[`agent:${node.card.executionId}`] ?? [node.x, node.y];
      return { ...node, x, y };
    }),
    taskLeaves: target.taskLeaves.map(leaf => {
      const [x, y] = display.points[`task:${leaf.id}`] ?? [leaf.x, leaf.y];
      return { ...leaf, x, y };
    }),
  };
}
