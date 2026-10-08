import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ErrorBoundary } from './ErrorBoundary';

describe('error recovery identity boundary', () => {
  it('retains the existing internal diagnostic/cache recovery by default', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { error: new Error('Synthetic diagnostic'), info: '' };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('Clear cached data and reload');
    expect(html).toContain('Synthetic diagnostic');
  });
  it('shows a safe client error without internal cache controls or raw diagnostics', () => {
    const boundary = new ErrorBoundary({ children: null, internal: false });
    boundary.state = { error: new Error('Internal diagnostic not for client'), info: 'Internal stack' };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('Reload page');
    expect(html).not.toContain('Clear cached data');
    expect(html).not.toContain('Internal diagnostic');
    expect(html).not.toContain('Internal stack');
  });
  it('does not write raw client render errors or component stacks to console', () => {
    const boundary = new ErrorBoundary({ children: null, internal: false });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const state = vi.spyOn(boundary, 'setState').mockImplementation(() => undefined);
    try {
      boundary.componentDidCatch(new Error('Private diagnostic'), { componentStack: 'Private component stack' });
      expect(log).toHaveBeenCalledExactlyOnceWith('[Alpha] client page render crash');
      expect(state).toHaveBeenCalledWith({ info: '' });
    } finally { log.mockRestore(); state.mockRestore(); }
  });
});
