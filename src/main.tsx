import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import { AppProvider } from '@/app/AppContext';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import './index.css';

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
