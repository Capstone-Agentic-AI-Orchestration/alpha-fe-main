import React from 'react';
import ReactDOM from 'react-dom/client';
import AppEntry from '@/app/AppEntry';
import { selectAppEntry } from '@/features/ticketing/entry';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import './index.css';
import { ThemeProvider } from '@/shared/theme';

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

  return <ThemeProvider enabled={['internal','client-portal','preview-client','preview-pm'].includes(entry)}>
    <ErrorBoundary key={entry} internal={entry === 'internal'}><AppEntry entry={entry} /></ErrorBoundary>
  </ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outside AppProvider: the provider itself reads localStorage during
        initialisation, so a crash there must still be caught and displayed. */}
    <ApplicationRoot />
  </React.StrictMode>,
);
