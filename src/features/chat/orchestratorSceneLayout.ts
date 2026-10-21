export type Vec3 = [number, number, number];

/**
 * Where agents sit around the Orchestrator: spread over a flattened sphere,
 * so they fill the space in front of, behind, above and below it instead of a
 * single line. Height and angle both step by the golden ratio, which keeps
 * neighbours apart for any count, and an agent's place depends only on its own
 * index, so the agents already shown stay put when another one joins.
 */
export function agentPositions(count: number, radius = 3.4): Vec3[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const y = (((0.5 + index * 0.6180339887) % 1) * 2 - 1) * 0.9;
    const ring = Math.sqrt(1 - y * y);
    const theta = golden * index + 0.6;
    return [Math.cos(theta) * ring * radius * 1.3, y * radius * 0.6, Math.sin(theta) * ring * radius] as Vec3;
  });
}

/** Height of the dot floor at a point; u runs left to right, v back to front. Same wave as the 2D bar. */
export function waveAt(u: number, v: number, t: number): number {
  return Math.sin(u * 5.5 + t + v * 1.8) * 0.55
    + Math.sin(u * 11 - t * 1.3 + v * 3.2) * 0.22
    + Math.cos(v * 4 + t * 0.7 + u * 2.4) * 0.3;
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

