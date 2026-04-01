import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.BUILD_NUMBER || 'dev'),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA || 'local'),
  },
  plugins: [
    react(),
    checker({
      typescript: {
        tsconfigPath: './tsconfig.app.json',
      },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Cache audio files from Firebase Storage
            urlPattern: /^https:\/\/storage\.googleapis\.com\/.*\.(mp3|wav)(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'polingu-audio',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Polingu - Polish Language Learning',
        short_name: 'Polingu',
        description: 'Learn Polish with spaced repetition',
        theme_color: '#c23a22',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/polingu.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
    }),
  ],
});
