import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { drawWave, OrchestratorFlow } from './OrchestratorFlow';
import { rgbChannels, useTheme, type ScenePalette } from '@/shared/theme';
import type { LiveBuildRoomAgentCard } from '@/shared/types';
import { AgentHandoffGraph } from '@/features/live-build-room/AgentHandoffGraph';

const fixture: ScenePalette = {
  background: '#f0f1f2', hub: '#112233', hubEmissive: '#223344', idle: '#334455',
  orbit: '#445566', ring: '#556677', wave: '#667788', waveActive: '#778899',
  highlight: '#8899aa', glow: '#99aabb', labelBackground: '#aabbcc', labelForeground: '#bbccdd',
  success: '#006600', warning: '#886600', danger: '#aa0000', info: '#006688',
};
vi.mock('@/shared/theme', async importOriginal => ({
  ...await importOriginal<typeof import('@/shared/theme')>(),
  useTheme: vi.fn(),
}));
// The DOM overlay is rendered on the server here; layout measurement runs in the browser.
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>();
  return { ...react, useLayoutEffect: react.useEffect };
});

function canvasRecorder() {
  const paints: string[] = [];
  const stops: string[] = [];
  const context = {
    set fillStyle(value: string | CanvasGradient) { if (typeof value === 'string') paints.push(value); },
    set strokeStyle(value: string | CanvasGradient) { if (typeof value === 'string') paints.push(value); },
    createRadialGradient: () => ({ addColorStop: (_offset: number, color: string) => stops.push(color) }),
    createLinearGradient: () => ({ addColorStop: (_offset: number, color: string) => stops.push(color) }),
    setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), fillText: vi.fn(),
  };
  const canvas = {
    width: 0, height: 0,
    getBoundingClientRect: () => ({ width: 600, height: 184 }),
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, paints, stops };
}

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Canvas palette updates', () => {
  it.each([false, true])('recolors a still frame without moving nodes or changing identity tones (working=%s)', working => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    const { canvas, paints, stops } = canvasRecorder();
    const state = {
      palette: fixture, expanded: true, working,
      agents: [{ id: 'specialist', initial: 'S', tone: '240, 112, 32', active: working }],
      hoveredId: null, selectedId: 'specialist', hubId: 'hub', flashRgb: null, flashAmount: 0,
    };
    const before = drawWave(canvas, state, 0);
    expect(paints).toContain(`rgb(${rgbChannels(working ? fixture.waveActive : fixture.wave)})`);
    expect(stops).toContain('rgba(240, 112, 32, 0.95)');
    paints.length = stops.length = 0;
    const next = { ...fixture, wave: '#abcdef', waveActive: '#fedcba', ring: '#123456', highlight: '#654321' };
    expect(drawWave(canvas, { ...state, palette: next }, 0)).toEqual(before);
    expect(paints).toContain(`rgb(${rgbChannels(working ? next.waveActive : next.wave)})`);
    expect(paints).toContain(`rgba(${rgbChannels(next.ring)}, 0.85)`);
    expect(stops).toContain(`rgba(${rgbChannels(next.highlight)}, 0.95)`);
    expect(stops).toContain('rgba(240, 112, 32, 0.95)');
  });

  it('keeps the compact bar neutral and its execution count at zero after work ends', () => {
    vi.mocked(useTheme).mockReturnValue({ theme: { scene: fixture } } as ReturnType<typeof useTheme>);
    const html = renderToStaticMarkup(<OrchestratorFlow calls={[]} agents={[]} title="Project" isWorking={false}
      build={{ runId: 'stopped', label: 'Stopped', running: false, agents: [] }} />);
    expect(html).toContain('data-agent-execution-count="0"');
    expect(html).toContain('No agents running');
    expect(html).toContain(`--scene-background:${rgbChannels(fixture.background)}`);
  });

  it('uses the same status palette in workflow labels and SVG fallback without changing layout', () => {
    const cards: LiveBuildRoomAgentCard[] = ['completed', 'failed'].map((status, index) => ({
      executionId: `run:${index}`, runId: `${index}`, agentId: `agent:${index}`, agentName: `Specialist ${index}`,
      agentRole: 'Specialist', source: 'agent_run', sourceLabel: 'Build',
      status: status as LiveBuildRoomAgentCard['status'], progress: 0, currentTask: 'Assigned work', activity: [],
    }));
    const render = (palette: ScenePalette) => {
      vi.mocked(useTheme).mockReturnValue({ theme: { scene: palette } } as ReturnType<typeof useTheme>);
      return renderToStaticMarkup(<AgentHandoffGraph cards={cards} allAgentCount={2} handoffs={[]} onSelect={vi.fn()} />);
    };
    const before = render(fixture);
    const next = { ...fixture, success: '#008800', danger: '#ff0011', highlight: '#123456' };
    const after = render(next);
    expect(before).toContain(`stroke="${fixture.success}"`);
    expect(after).toContain(`stroke="${next.success}"`);
    expect(after).toContain(`stroke="${next.danger}"`);
    expect(after).toContain(`stop-color="${next.highlight}"`);
    expect(after).toContain('background-color:#008800');
    expect(after.match(/transform="translate\([^)]+\)"/g)).toEqual(before.match(/transform="translate\([^)]+\)"/g));
  });
});
