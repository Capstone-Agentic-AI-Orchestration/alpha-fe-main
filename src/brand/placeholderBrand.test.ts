import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The public site was first built under the placeholder brand "Cosmo" and
 * rebranded to Alphaexplora. Older branches and worktrees still carry Cosmo
 * files, so this fails the moment any of it is copied back in: names, alt
 * text, classes, events, storage keys or assets. Name things after the brand
 * (see src/brand/brand.ts) instead.
 */
const ROOT = path.resolve(__dirname, '../..');
const SCANNED = ['src', 'public', 'scripts', 'index.html', 'vite.config.ts'];
const TEXT = /\.(tsx?|jsx?|mjs|cjs|css|html|json|svg|md|txt)$/i;
const PLACEHOLDER = /cosmo/i;

function files(entry: string): string[] {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [entry];
  return fs.readdirSync(full).flatMap(name => files(path.join(entry, name)));
}

describe('the old placeholder brand', () => {
  it('is gone from the code, the assets and their names', () => {
    const hits: string[] = [];
    SCANNED.flatMap(files).forEach(file => {
      if (PLACEHOLDER.test(file)) hits.push(`${file} (file name)`);
      if (!TEXT.test(file) || file.endsWith(path.basename(__filename))) return;
      fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, index) => {
        if (PLACEHOLDER.test(line)) hits.push(`${file}:${index + 1}  ${line.trim().slice(0, 100)}`);
      });
    });
    expect(hits, `Placeholder brand found; use the Alphaexplora names from src/brand instead:\n${hits.join('\n')}`).toEqual([]);
  });
});
