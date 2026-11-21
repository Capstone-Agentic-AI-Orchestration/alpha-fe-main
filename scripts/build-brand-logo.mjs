/**
 * Builds the Alphaexplora logo files from the mark's stroke geometry and the
 * bundled DM Sans font, so the lockup can be regenerated when the spacing or
 * the mark changes:
 *
 *   src/assets/alphaexplora-wordmark.svg   letters only, for the canvas scenes
 *   public/alphaexplora-wordmark.svg       the same, for the inlined loader
 *   src/assets/alphaexplora-logo.svg       mark + wordmark, for the page headers
 *   src/assets/alphaexplora-mark.svg       mark only, for headers on narrow screens
 *   src/brand/logoMetrics.json             their sizes, so <img> tags reserve space
 *
 * Letters are outlined to paths: an SVG drawn through <img> or drawImage can't
 * load web fonts. Run with `npm run brand:logo`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = file => path.join(root, file);

const NAME = 'ALPHAEXPLORA';
const FONT = 'src/assets/fonts/dm-sans-400.ttf';
const INK = '#f5f3fc';
const MARK_INK = '#f8f7ff';
/** Wide tracking, as in the old lockup's letter spacing. */
const TRACKING = 0.3;
/** Wordmark cap height as a share of the mark's height. */
const CAP_SHARE = 0.2;
/** Gap between mark and wordmark as a share of the mark's height. */
const GAP_SHARE = 0.16;
/** Where the wordmark's middle sits down the mark, as a share of its height: the A's body, not the box, since the orbit and trails make the box bottom-heavy. */
const CENTRE_SHARE = 0.47;

const mark = JSON.parse(fs.readFileSync(at('src/brand/alphaexploraMark.json'), 'utf8'));
const font = opentype.loadSync(at(FONT));
const round = v => Math.round(v * 100) / 100;

/** The wordmark as one outlined path, its top at y = 0 and its baseline at y = cap height. */
function wordmark(capHeight) {
  const size = capHeight / (font.tables.os2.sCapHeight / font.unitsPerEm);
  const scale = size / font.unitsPerEm;
  let x = 0, d = '';
  [...NAME].forEach((letter, index) => {
    const glyph = font.charToGlyph(letter);
    const box = glyph.getBoundingBox();
    // Start each letter at its ink, so the wordmark has no side bearing on either end.
    if (index === 0) x = -box.x1 * scale;
    d += glyph.getPath(x, capHeight, size).toPathData(2);
    x += glyph.advanceWidth * scale + (index < NAME.length - 1 ? TRACKING * size : 0);
  });
  const last = font.charToGlyph(NAME.at(-1));
  const width = x - (last.advanceWidth - last.getBoundingBox().x2) * scale;
  return { d, width: round(width), height: round(capHeight) };
}

function markStrokes() {
  return mark.strokes.map(stroke => {
    const d = stroke.cubic
      ? `M${stroke.cubic[0].join(' ')} C${stroke.cubic.slice(1).map(p => p.join(' ')).join(' ')}`
      : `M${stroke.line.map(p => p.join(' ')).join(' L')}`;
    return `<path d="${d}"/>`;
  }).join('');
}

const [markW, markH] = mark.viewBox;
const capHeight = markH * CAP_SHARE;
const word = wordmark(capHeight);

const wordSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${word.width} ${word.height}" width="${word.width}" height="${word.height}"><path fill="${INK}" d="${word.d}"/></svg>\n`;

const gap = markH * GAP_SHARE;
const wordTop = round(markH * CENTRE_SHARE - capHeight / 2);
const logoW = round(markW + gap + word.width);
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${logoW} ${markH}" width="${logoW}" height="${markH}">`
  + `<g fill="none" stroke="${MARK_INK}" stroke-width="${mark.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${markStrokes()}</g>`
  + `<path fill="${INK}" transform="translate(${round(markW + gap)} ${wordTop})" d="${word.d}"/></svg>\n`;

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${markW} ${markH}" width="${markW}" height="${markH}">`
  + `<g fill="none" stroke="${MARK_INK}" stroke-width="${mark.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${markStrokes()}</g></svg>\n`;

fs.writeFileSync(at('src/assets/alphaexplora-mark.svg'), markSvg);
fs.writeFileSync(at('src/assets/alphaexplora-wordmark.svg'), wordSvg);
fs.writeFileSync(at('public/alphaexplora-wordmark.svg'), wordSvg);
fs.writeFileSync(at('src/assets/alphaexplora-logo.svg'), logoSvg);
fs.writeFileSync(at('src/brand/logoMetrics.json'), JSON.stringify({ logo: { width: logoW, height: markH }, mark: { width: markW, height: markH }, wordmark: { width: word.width, height: word.height } }, null, 2) + '\n');
console.log(`logo ${logoW}×${markH}, wordmark ${word.width}×${word.height}`);
