import { describe, expect, it } from 'vitest';
import type { RuntimeEngine } from '@/shared/types';
import { modelMaker, modelSourceNote, modelsByMaker } from './providers';

const runtimes = [
  { id: 'claude', name: 'Claude Code CLI', provider: 'Anthropic', status: 'online', models: ['claude-sonnet-5'] },
  { id: 'antigravity', name: 'Google Antigravity', provider: 'Antigravity', status: 'online', models: ['gemini-3.8-flash-high', 'claude-opus-4-6-thinking'] }
] as unknown as RuntimeEngine[];

describe('where a model runs and who makes it', () => {
  it('names the maker separately from the runtime when they differ', () => {
    expect(modelMaker('claude-opus-4-6-thinking')).toBe('Anthropic');
    expect(modelMaker('opencode/gpt-6-luna')).toBe('OpenAI');
    expect(modelSourceNote(runtimes, 'Antigravity', 'claude-opus-4-6-thinking'))
      .toBe('Made by Anthropic, run by Google Antigravity. Usage counts against your Google Antigravity plan.');
    expect(modelSourceNote(runtimes, 'Anthropic', 'claude-sonnet-5')).toBe('Usage counts against your Claude Code CLI plan.');
  });

  it('groups a mixed catalog by maker', () => {
    expect(modelsByMaker(['gemini-3.8-flash-high', 'claude-opus-4-6-thinking', 'gpt-oss-120b-medium'])).toEqual([
      { maker: 'Google', models: ['gemini-3.8-flash-high'] },
      { maker: 'Anthropic', models: ['claude-opus-4-6-thinking'] },
      { maker: 'OpenAI', models: ['gpt-oss-120b-medium'] }
    ]);
  });
});
