import { describe, expect, it } from 'vitest';
import { atomPositions, onScreen, orbitPath, ORBIT_RADIUS, ORBIT_WIDTH } from './orchestratorSceneLayout';

const gap = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('atomPositions', () => {
  it('places every agent on one of the three orbits', () => {
    for (const count of [1, 3, 6, 11, 16, 20]) {
      const points = atomPositions(count);
      expect(points).toHaveLength(count);
      for (const point of points) expect(Math.hypot(point[0] / ORBIT_WIDTH, point[1], point[2])).toBeCloseTo(ORBIT_RADIUS, 5);
    }
  });

  it('keeps agents apart from each other and from the Orchestrator as the camera first sees them', () => {
    const hub = onScreen([0, 0, 0]);
    for (const count of [3, 6, 11, 16, 20]) {
      const seen = atomPositions(count).map(onScreen);
      // Orbs are 0.56 across, so 0.9 leaves clear space between any two.
      for (let a = 0; a < count; a += 1) {
        expect(gap(seen[a], hub)).toBeGreaterThan(1);
        for (let b = a + 1; b < count; b += 1) expect(gap(seen[a], seen[b])).toBeGreaterThan(0.9);
      }
    }
  });

  it('gives the same places every time, so agents never move between renders', () => {
    expect(atomPositions(16)).toEqual(atomPositions(16));
  });

  it('draws closed orbit lines', () => {
    const path = orbitPath(0, 32);
    expect(path).toHaveLength(33);
    expect(path[0][0]).toBeCloseTo(path[32][0], 6);
    expect(path[0][1]).toBeCloseTo(path[32][1], 6);
  });
});

