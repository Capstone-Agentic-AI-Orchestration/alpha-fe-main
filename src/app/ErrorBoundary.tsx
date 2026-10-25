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
  /** Client entry must never inspect/reset the internal browser cache. */
  internal?: boolean;
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
    if (this.props.internal === false) {
      console.error('[Alpha] client page render crash');
      this.setState({ info: '' });
      return;
    }
    // Also log it, so the console has the full trace when it is available.
    console.error('[Alpha] render crash:', error, info.componentStack);
    this.setState({ info: info.componentStack ?? '' });
  }

  private clearLocalState = () => {
    if (this.props.internal === false) return;
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

    if (this.props.internal === false) return (
      <main className="min-h-dvh flex items-center justify-center bg-canvas p-6">
        <section role="alert" className="max-w-md space-y-4 rounded-xl border border-divider bg-surface p-6">
          <h1 className="text-lg font-semibold text-content">This page could not be displayed</h1>
          <p className="text-sm text-content-secondary">Reload to try again. No ticket submission or approval is confirmed by this error.</p>
          <button className="rounded-lg bg-action px-4 py-2 text-sm text-on-action" onClick={() => window.location.reload()}>Reload page</button>
        </section>
      </main>
    );

    return (
      <div className="min-h-screen bg-background text-content flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-5">
          <div>
            <h1 className="text-lg font-semibold">Alpha hit a rendering error</h1>
            <p className="text-sm text-content-secondary mt-1">
              The interface stopped instead of showing a blank screen. The cause is below.
            </p>
          </div>

          <div className="rounded-lg border border-status-danger-border bg-status-danger-subtle p-4">
            <div className="text-xs font-mono uppercase tracking-wider text-status-danger mb-2">
              {error.name}
            </div>
            <div className="text-sm font-mono text-status-danger break-words">{error.message}</div>
          </div>

          {/* Open by default: a collapsed trace is a trace nobody reads, and
              this panel exists precisely for the moments when the console is
              not available. */}
          {info && (
            <div className="rounded-lg border border-divider bg-surface p-4">
              <div className="text-xs font-medium text-content-secondary mb-2">
                Component stack — the first entry is where it threw
              </div>
              <pre className="text-[11px] font-mono text-status-warning whitespace-pre-wrap max-h-40 overflow-y-auto">
                {info.trim().split('\n').slice(0, 8).join('\n')}
              </pre>
            </div>
          )}

          {error.stack && (
            <details className="rounded-lg border border-divider bg-surface p-4">
              <summary className="text-xs font-medium text-content-secondary cursor-pointer">
                Full JavaScript stack
              </summary>
              <pre className="mt-3 text-[11px] font-mono text-content-secondary whitespace-pre-wrap max-h-64 overflow-y-auto">
                {error.stack}
              </pre>
            </details>
          )}

          <div className="rounded-lg border border-divider bg-surface p-4 space-y-3">
            <p className="text-sm text-content-secondary">
              Reloading retries the page. If this started after an update, you can reset Alpha's
              saved browser state. Your projects and agents remain in the local daemon.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={this.clearLocalState}
                className="px-3 py-1.5 rounded-lg bg-action hover:bg-action-hover text-on-action text-xs font-medium transition-colors"
              >
                Reset saved app data and reload
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-high text-content text-xs font-medium transition-colors"
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
