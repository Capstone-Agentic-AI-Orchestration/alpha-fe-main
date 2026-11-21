import { describe, expect, it } from 'vitest';
import mark from './alphaexploraMark.json';
import { MARK_APEX, MARK_HALF_WIDTH, MARK_ORBIT_CENTRE, MARK_STROKES, markPoint, particleDrawn, sampleMark, seeded, strokeDrawn } from './markParticles';

describe('Alphaexplora mark particles', () => {
  it('is the same cloud for the same seed', () => {
    expect(sampleMark(seeded(7), 400)).toEqual(sampleMark(seeded(7), 400));
  });

  it('keeps every dot on the mark, inside its box plus the halo', () => {
    const reach = 1 + MARK_HALF_WIDTH * 4;
    sampleMark(seeded(3)).forEach(particle => {
      const [x, y] = markPoint(particle);
      expect(Math.abs(y)).toBeLessThanOrEqual(reach);
      expect(Math.abs(x)).toBeLessThanOrEqual(reach);
    });
  });

  it('spreads dots by stroke length, so short trails are not over-weighted', () => {
    const cloud = sampleMark(seeded(9), 3000);
    const total = MARK_STROKES.reduce((sum, stroke) => sum + stroke.length, 0);
    MARK_STROKES.forEach((stroke, index) => {
      const share = cloud.filter(p => p[0] === index).length / cloud.length;
      expect(share).toBeCloseTo(stroke.length / total, 2);
    });
  });

  it('turns only the orbit, around the orbit centre', () => {
    const cloud = sampleMark(seeded(5), 600);
    cloud.forEach(particle => {
      const still = markPoint(particle), turned = markPoint(particle, 0.7);
      if (MARK_STROKES[particle[0]].layer === 'orbit') {
        const before = Math.hypot(still[0] - MARK_ORBIT_CENTRE[0], still[1] - MARK_ORBIT_CENTRE[1]);
        const after = Math.hypot(turned[0] - MARK_ORBIT_CENTRE[0], turned[1] - MARK_ORBIT_CENTRE[1]);
        expect(after).toBeCloseTo(before, 6);
      } else expect(turned).toEqual(still);
    });
  });

  it('draws every stroke in the loading animation order and lights every dot by the end', () => {
    expect(MARK_STROKES.map(stroke => stroke.id)).toEqual(mark.strokes.map(stroke => stroke.id));
    MARK_STROKES.forEach((_, index) => { expect(strokeDrawn(index, 0)).toBe(0); expect(strokeDrawn(index, 1)).toBe(1); });
    sampleMark(seeded(2), 500).forEach(particle => expect(particleDrawn(particle, 1)).toBe(1));
  });

  it('meets both legs at the apex', () => {
    const [left, right] = MARK_STROKES;
    [left.at(1), right.at(0)].forEach(([x, y]) => { expect(x).toBeCloseTo(MARK_APEX[0], 9); expect(y).toBeCloseTo(MARK_APEX[1], 9); });
  });
});
