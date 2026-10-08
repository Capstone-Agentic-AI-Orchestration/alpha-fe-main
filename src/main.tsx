import React from 'react';
import ReactDOM from 'react-dom/client';
import AppEntry from '@/app/AppEntry';
import { selectAppEntry } from '@/features/ticketing/entry';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import alphaMarkUrl from '@/assets/alpha-mark.png';
import './index.css';

// Keep the browser tab and the sidebar on the same source of truth for the
// brand mark. The imported asset is transformed correctly for both Vite's web
// build and the packaged desktop renderer.
const favicon = document.querySelector<HTMLLinkElement>('#alpha-favicon');
if (favicon) {
  favicon.href = alphaMarkUrl;
  favicon.type = 'image/png';
}

function ApplicationRoot() {
  const [entry, setEntry] = React.useState(() => selectAppEntry(window.location, import.meta.env.DEV));
  React.useEffect(() => {
    const updateEntry = () => setEntry(selectAppEntry(window.location, import.meta.env.DEV));
    window.addEventListener('hashchange', updateEntry);
    window.addEventListener('popstate', updateEntry);
    return () => {
      window.removeEventListener('hashchange', updateEntry);
      window.removeEventListener('popstate', updateEntry);
    };
  }, []);

  return <ErrorBoundary key={entry} internal={entry === 'internal'}>
    <AppEntry entry={entry} />
  </ErrorBoundary>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outside AppProvider: the provider itself reads localStorage during
        initialisation, so a crash there must still be caught and displayed. */}
    <ApplicationRoot />
  </React.StrictMode>,
);
