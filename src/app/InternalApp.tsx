import App from './App';
import { AppProvider } from './AppContext';

/** Keep the internal module graph out of the client entry entirely. */
export default function InternalApp() {
  return <AppProvider><App /></AppProvider>;
}
