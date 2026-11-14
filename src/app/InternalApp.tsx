import App from './App';
import { ProviderUsageProvider } from '@/shared/layout/ProviderUsageContext';
import { AppProvider } from './AppContext';

/** Keep the internal module graph out of the client entry entirely. */
export default function InternalApp() {
  return <AppProvider><ProviderUsageProvider><App /></ProviderUsageProvider></AppProvider>;
}
