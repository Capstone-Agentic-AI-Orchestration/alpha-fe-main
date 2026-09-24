import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import { AppProvider } from '@/app/AppContext';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outside AppProvider: the provider itself reads localStorage during
        initialisation, so a crash there must still be caught and displayed. */}
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
