import App from './App';
import { ProviderUsageProvider } from '@/shared/layout/ProviderUsageContext';
import { AppProvider } from './AppContext';
import { AttentionProvider } from '@/features/attention/AttentionContext';

/** Keep the internal module graph out of the client entry entirely. */
export default function InternalApp() {
  return <AppProvider><ProviderUsageProvider><AttentionProvider><App /></AttentionProvider></ProviderUsageProvider></AppProvider>;
}
