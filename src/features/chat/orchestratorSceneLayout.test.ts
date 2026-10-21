import { describe, expect, it } from 'vitest';
import { agentPositions } from './orchestratorSceneLayout';

describe('agentPositions', () => {
  it('spreads agents through all three dimensions without overlapping orbs', () => {
    for (const count of [2, 3, 6, 12]) {
      const points = agentPositions(count);
      for (let a = 0; a < count; a += 1) {
        for (let b = a + 1; b < count; b += 1) {
          expect(Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1], points[a][2] - points[b][2])).toBeGreaterThan(0.9);
        }
      }
    }
    const six = agentPositions(6);
    expect(new Set(six.map(point => Math.sign(point[1])))).toEqual(new Set([-1, 0, 1]));
    expect(new Set(six.map(point => Math.sign(point[2])))).toEqual(new Set([-1, 1]));
  });

  it('keeps the agents already shown in place when another one joins', () => {
    expect(agentPositions(5).slice(0, 3)).toEqual(agentPositions(3));
  });
});

