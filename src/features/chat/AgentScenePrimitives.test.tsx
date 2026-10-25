import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Children, isValidElement, type EffectCallback, type ReactNode } from 'react';
import * as THREE from 'three';
import type { ScenePalette } from '@/shared/theme';
import { AgentSceneOrb, SceneThemeFrame } from './AgentScenePrimitives';

const harness = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  render: vi.fn(),
  setClearColor: vi.fn(),
  invalidate: vi.fn(),
  frameloop: 'never',
  scene: {},
  camera: {},
}));
vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: EffectCallback) => { harness.effects.push(effect); },
  useRef: (current: unknown) => ({ current }),
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: () => ({
    gl: { render: harness.render, setClearColor: harness.setClearColor },
    scene: harness.scene, camera: harness.camera,
    frameloop: harness.frameloop, invalidate: harness.invalidate,
  }),
}));
vi.mock('@react-three/drei', () => ({ Billboard: 'billboard' }));

const palette: ScenePalette = {
  background: '#eeeeee', hub: '#445566', hubEmissive: '#334455', idle: '#666666',
  orbit: '#556677', ring: '#778899', wave: '#8899aa', waveActive: '#99aabb',
  highlight: '#ffffff', glow: '#aabbcc', labelBackground: '#eeeeff', labelForeground: '#111122',
  success: '#008800', warning: '#aa8800', danger: '#cc0000', info: '#0088aa',
};

function materialProps(tree: ReactNode, type: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  Children.forEach(tree, child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === type) result.push(child.props);
    result.push(...materialProps(child.props.children, type));
  });
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.effects = [];
  harness.frameloop = 'never';
});

describe('theme frames', () => {
  it('repaints a paused scene in place without running animation subscribers', () => {
    for (const next of [palette, { ...palette, background: '#111111' }]) {
      expect(SceneThemeFrame({ palette: next })).toBeNull();
      harness.effects.pop()!();
      expect(harness.setClearColor).toHaveBeenLastCalledWith(next.background, 0);
      expect(harness.render).toHaveBeenLastCalledWith(harness.scene, harness.camera);
    }
    expect(harness.render).toHaveBeenCalledTimes(2);
    expect(harness.invalidate).not.toHaveBeenCalled();
  });

  it('requests a frame for demand rendering', () => {
    harness.frameloop = 'demand';
    SceneThemeFrame({ palette });
    harness.effects.pop()!();
    expect(harness.invalidate).toHaveBeenCalledOnce();
    expect(harness.render).not.toHaveBeenCalled();
  });
});

describe('orb materials', () => {
  it('retains an agent identity color while changing selection and hub materials', () => {
    const glow = new THREE.Texture();
    const agent = AgentSceneOrb({ palette, glow, color: '#f07020', active: true, selected: true });
    expect(materialProps(agent, 'meshPhysicalMaterial')[0]).toMatchObject({ color: '#f07020', emissive: '#f07020' });
    expect(materialProps(agent, 'meshBasicMaterial')[0]).toMatchObject({ color: palette.highlight });
    const hub = AgentSceneOrb({ palette, glow, color: palette.hub, active: true, hub: true, reduceMotion: true });
    expect(materialProps(hub, 'meshPhysicalMaterial')[0]).toMatchObject({ color: palette.hub, emissive: palette.hubEmissive });
    expect(materialProps(hub, 'meshBasicMaterial')[0]).toMatchObject({ color: palette.ring, opacity: 0.15 });
    glow.dispose();
  });
});
