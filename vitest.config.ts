import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

/** Keep application build/serve config intact; only avoid worker realpath
 * resolution that is denied by restricted Windows test environments.
 */
export default defineConfig(async configEnv => {
  const applicationConfig = typeof viteConfig === 'function'
    ? await viteConfig(configEnv)
    : viteConfig;
  return mergeConfig(applicationConfig, { resolve: { preserveSymlinks: true } });
});
