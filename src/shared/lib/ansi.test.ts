import { describe, expect, it } from 'vitest';
import { stripAnsi } from './ansi';

describe('stripAnsi', () => {
  it('strips terminal colour codes from a message', () => {
    const esc = String.fromCharCode(27);
    expect(stripAnsi(`${esc}[32m==> Build successful${esc}[0m`)).toBe('==> Build successful');
    expect(stripAnsi(`[npm run build] ${esc}[2mdist/${esc}[22m${esc}[36massets/index.js${esc}[39m`)).toBe('[npm run build] dist/assets/index.js');
    expect(stripAnsi('plain')).toBe('plain');
  });
});
