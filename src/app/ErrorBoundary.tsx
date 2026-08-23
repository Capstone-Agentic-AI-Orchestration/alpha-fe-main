import React from 'react';

/**
 * Catches render-time crashes and shows the error instead of a blank screen.
 *
 * Without this, any throw during render unmounts the whole tree and leaves the
 * page empty — indistinguishable from a broken build, a stale dev server, or a
 * missing stylesheet. Diagnosing it then requires the browser console, which is
 * not always available (packaged desktop builds have no devtools by default).
 *
 * Most crashes here come from PERSISTED STATE rather than code: `localStorage`
 * holds data written by an older version of the app, and a shape that no longer
 * matches throws on first render. A fresh browser works while the developer's
 * does not — which is exactly how this component came to exist. Hence the reset
 * button: it clears Alpha's own keys and reloads.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

const STORAGE_PREFIX = 'alpha_multica_';

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Also log it, so the console has the full trace when it is available.
    console.error('[Alpha] render crash:', error, info.componentStack);
    this.setState({ info: info.componentStack ?? '' });
  }

  private clearLocalState = () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(STORAGE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {
      // Private mode or blocked storage — reloading is still worth a try.
    }
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-5">
          <div>
            <h1 className="text-lg font-semibold">Alpha hit a rendering error</h1>
            <p className="text-sm text-gray-400 mt-1">
              The interface stopped instead of showing a blank screen. The cause is below.
            </p>
          </div>

          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-rose-300 mb-2">
              {error.name}
            </div>
            <div className="text-sm font-mono text-rose-100 break-words">{error.message}</div>
          </div>

          {/* Open by default: a collapsed trace is a trace nobody reads, and
              this panel exists precisely for the moments when the console is
              not available. */}
          {info && (
            <div className="rounded-lg border border-white/10 bg-surface-200 p-4">
              <div className="text-xs font-medium text-gray-300 mb-2">
                Component stack — the first entry is where it threw
              </div>
              <pre className="text-[11px] font-mono text-amber-200/90 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {info.trim().split('\n').slice(0, 8).join('\n')}
              </pre>
            </div>
          )}

          {error.stack && (
            <details className="rounded-lg border border-white/10 bg-surface-200 p-4">
              <summary className="text-xs font-medium text-gray-300 cursor-pointer">
                Full JavaScript stack
              </summary>
              <pre className="mt-3 text-[11px] font-mono text-gray-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="rounded-lg border border-white/10 bg-surface-200 p-4 space-y-3">
            <p className="text-sm text-gray-300">
              Most crashes here come from cached data written by an older version of Alpha.
              Clearing it keeps your projects and agents — those live in the local daemon,
              not the browser.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.clearLocalState}
                className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
              >
                Clear cached data and reload
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
              >
                Reload only
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
