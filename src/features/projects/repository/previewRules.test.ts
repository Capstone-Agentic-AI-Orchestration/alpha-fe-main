import { describe, expect, it } from 'vitest';

import type { BranchPreview } from '@/shared/types';
import { canFramePreview, PREVIEW_FRAME_SANDBOX, previewFrameSandbox, previewUnavailableReason } from './previewRules';

/** When a hosted branch's site may be framed inside Alpha, and with what sandbox. */

const preview = (overrides: Partial<BranchPreview> = {}): BranchPreview => ({
  branch: 'main',
  url: 'https://shop.vercel.app',
  surface: 'page',
  deployStatus: 'READY',
  ready: true,
  embeddable: true,
  reason: null,
  ...overrides
});

describe('framing a preview', () => {
  it('frames only a live page the server said may be framed', () => {
    expect(canFramePreview(preview())).toBe(true);
    expect(canFramePreview(preview({ embeddable: null }))).toBe(false);
    expect(canFramePreview(preview({ embeddable: false }))).toBe(false);
    expect(canFramePreview(preview({ ready: false }))).toBe(false);
    expect(canFramePreview(preview({ url: null }))).toBe(false);
    expect(canFramePreview(preview({ surface: 'health' }))).toBe(false);
  });

  it('says why a preview is not shown', () => {
    expect(previewUnavailableReason(preview({ url: null }))).toMatch(/not been deployed/);
    expect(previewUnavailableReason(preview({ ready: false, deployStatus: 'BUILDING' }))).toBe('The latest deploy is building.');
    expect(previewUnavailableReason(preview({ embeddable: false, reason: 'Sign-in wall.' }))).toBe('Sign-in wall.');
  });
});

describe('the frame sandbox', () => {
  const relaxed = `${PREVIEW_FRAME_SANDBOX} allow-same-origin`;

  it('lets a cross-origin site keep its own storage, in the browser', () => {
    expect(previewFrameSandbox('https://shop.vercel.app', 'https://alpha.example.com')).toBe(relaxed);
  });

  /** The desktop renderer is a file:// page; no hosted preview can share that origin. */
  it.each(['file://', 'null'])('does the same on the desktop, whose origin is %s', origin => {
    expect(previewFrameSandbox('https://shop.vercel.app', origin)).toBe(relaxed);
  });

  it('keeps the strict sandbox for a same-origin frame, which could otherwise lift its own sandbox', () => {
    expect(previewFrameSandbox('https://alpha.example.com/x', 'https://alpha.example.com')).toBe(PREVIEW_FRAME_SANDBOX);
  });

  it.each(['file:///etc/hosts', 'data:text/html,hi', 'not a url'])('keeps the strict sandbox for %s', url => {
    expect(previewFrameSandbox(url, 'file://')).toBe(PREVIEW_FRAME_SANDBOX);
  });
});
