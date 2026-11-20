import compression from 'compression';
import react from 'vite-phone-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Connect, InlineConfig, PluginOption } from 'vite-phone';

export function phonePreviewConfig(domain?: string, port = 5173): InlineConfig {
  return {
    configFile: false,
    cacheDir: 'node_modules/.vite-phone',
    define: {
      __BUILD_VERSION__: JSON.stringify(process.env.BUILD_NUMBER || 'dev'),
      __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA || 'local'),
    },
    experimental: { bundledDev: true },
    oxc: false,
    plugins: [
      // These plugins resolve their types against the project's primary Vite 7 install.
      react() as unknown as PluginOption,
      VitePWA({ registerType: 'prompt', injectRegister: null }) as unknown as PluginOption,
      {
        name: 'phone-preview-compression',
        configureServer(server) {
          server.middlewares.use(compression() as Connect.NextHandleFunction);
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      allowedHosts: domain ? [domain] : undefined,
      ws: domain ? { protocol: 'wss', host: domain, clientPort: 443 } : undefined,
    },
  };
}
