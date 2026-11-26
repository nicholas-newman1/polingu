import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Scheduling depends on the local calendar day. Pin a zone with daylight saving
// so date bugs reproduce the same way on every machine and in CI.
process.env.TZ = 'America/Toronto';

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_VERSION__: JSON.stringify('test'),
    __COMMIT_SHA__: JSON.stringify('test'),
  },
  test: {
    restoreMocks: true,
    unstubGlobals: true,
    projects: [
      {
        // App code: schedulers, storage/sync, hooks, content data.
        // Run with `npm test`.
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['tests/rules/**'],
          environment: 'jsdom',
          setupFiles: ['tests/setup/unit.ts'],
          // Page-level UI tests render the whole provider tree; leave room for slow CI runners.
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        // Cloud Functions logic. Run with `npm test`.
        extends: true,
        test: {
          name: 'functions',
          include: ['functions/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Firestore and Storage security rules. Needs the emulators, so run
        // with `npm run test:rules`, which starts them first.
        extends: true,
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.ts'],
          environment: 'node',
          // Rules files share one emulator; keep them from clearing each other's data.
          fileParallelism: false,
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
