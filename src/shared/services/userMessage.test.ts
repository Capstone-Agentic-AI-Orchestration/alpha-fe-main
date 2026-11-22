import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ApiRequestError, userMessage } from './apiService';

describe('the words a person sees for a failed request', () => {
  it('drops the API Error prefix and falls back when there is no message', () => {
    expect(userMessage(new ApiRequestError(409, 'API Error [409]: This plan is no longer waiting to start.'), 'Could not start.')).toBe('This plan is no longer waiting to start.');
    expect(userMessage(new Error('Network down'), 'Could not start.')).toBe('Network down');
    expect(userMessage('boom', 'Could not start.')).toBe('Could not start.');
    expect(userMessage(new Error('  '), 'Could not start.')).toBe('Could not start.');
  });

  it('is used, not error.message, on the build, chat, board and recovery screens', () => {
    // A raw error.message shows "API Error [409]: ..." to the person. Use userMessage(error, fallback).
    const folders = ['chat', 'board-build', 'board-run', 'board-agent', 'project-build-review', 'delivery'].map(folder => path.join('src', 'features', folder));
    const raw = /(\w+) instanceof Error \? \1\.message\b|(\w+)\?\.message \?\? /;
    const offenders: string[] = [];
    for (const folder of folders.filter(fs.existsSync)) {
      for (const file of fs.readdirSync(folder, { recursive: true }) as string[]) {
        if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) continue;
        const text = fs.readFileSync(path.join(folder, file), 'utf8');
        text.split('\n').forEach((line, index) => { if (raw.test(line)) offenders.push(`${path.join(folder, file)}:${index + 1}`); });
      }
    }
    expect(offenders).toEqual([]);
  });
});
