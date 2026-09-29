import type { BranchPreview } from '@/shared/types';

/**
 * When and how a hosted branch's site may be framed inside Alpha.
 */

/**
 * Only on the server's positive answer, for a live deploy with a stable
 * address. A browser fires no error event when a site refuses to be framed
 * (X-Frame-Options, CSP frame-ancestors, a sign-in wall), so framing on
 * anything less would show an unexplained blank box.
 */
export function canFramePreview(preview: BranchPreview): boolean {
  return preview.surface === 'page' && preview.embeddable === true && preview.ready && Boolean(preview.url);
}

/** Scripts and forms run, links open (the desktop sends every new window to the system browser). */
export const PREVIEW_FRAME_SANDBOX = 'allow-scripts allow-forms allow-popups';

/**
 * The sandbox for a frame of `frameUrl` inside a page at `appOrigin`.
 *
 * `allow-same-origin` lets the framed site keep its own storage and cookies --
 * many sites crash at boot without them -- and is safe only when the frame is
 * on a different origin from Alpha: a same-origin frame with scripts and
 * `allow-same-origin` could reach into the parent and strip its own sandbox.
 *
 * The desktop renderer's origin is `file://` (or the opaque `null`), which no
 * https preview can ever equal, so a hosted preview gets the relaxed sandbox
 * there too -- correctly: it is genuinely cross-origin. A frame URL that is
 * not http(s) (`file:`, `data:`, `blob:`) always gets the strict one.
 */
export function previewFrameSandbox(frameUrl: string, appOrigin: string | null): string {
  if (!appOrigin) return PREVIEW_FRAME_SANDBOX;
  let frame: URL;
  try {
    frame = new URL(frameUrl);
  } catch {
    return PREVIEW_FRAME_SANDBOX;
  }
  const isWeb = frame.protocol === 'https:' || frame.protocol === 'http:';
  if (!isWeb || frame.origin === appOrigin) return PREVIEW_FRAME_SANDBOX;
  return `${PREVIEW_FRAME_SANDBOX} allow-same-origin`;
}

/** Why a branch shows no inline preview, in words for the card. */
export function previewUnavailableReason(preview: BranchPreview): string {
  if (!preview.url) return 'No address yet — this branch has not been deployed.';
  if (!preview.ready)
    return preview.deployStatus ? `The latest deploy is ${preview.deployStatus.toLowerCase()}.` : 'Not deployed yet.';
  return preview.reason ?? 'This site cannot be shown inside Alpha. Open it in your browser instead.';
}
