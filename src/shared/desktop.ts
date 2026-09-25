/**
 * The Electron preload bridge, when the renderer is running inside one.
 *
 * The same renderer is served by Vercel and packed into the desktop installer,
 * so "am I the desktop app" is a runtime question, not a build-time one.
 * `window.alphaDesktop` is defined only by the packaged app's preload, which is
 * why this is read from the window rather than from an environment variable
 * Vite would bake in.
 *
 * Every member is optional apart from the flag: the bridge is deliberately
 * small and grows one capability at a time, so a renderer must cope with an
 * older preload that has not got the newest one yet.
 */
export type UpdateCheck =
  /** Already the newest release. */
  | { status: 'current'; version?: string }
  /** A newer release exists and is downloading; the restart dialog follows. */
  | { status: 'downloading'; version?: string }
  /** Run from source, or no GitHub sign-in to read releases with. */
  | { status: 'unsupported'; reason: string }
  | { status: 'error'; message: string };

export interface DesktopBridge {
  isDesktop: true;
  platform: string;
  /** Runtime loopback address for this app instance's local engine. */
  apiBase?: string;
  /** Runtime WebSocket address for this app instance's local engine. */
  wsUrl?: string;
  versions: { electron: string; node: string; chrome: string };
  checkForUpdates?: () => Promise<UpdateCheck>;
  /** The packaged app's own version. The renderer cannot read package.json. */
  appVersion?: () => Promise<string>;
}

export const desktop = (window as unknown as { alphaDesktop?: DesktopBridge }).alphaDesktop;

/** Whether this is the packaged desktop app rather than a browser tab. */
export const isDesktop = Boolean(desktop?.isDesktop);
