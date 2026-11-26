import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dev-server-only endpoint that mints a Firebase custom token for a dedicated,
 * non-admin test user, so the app can be exercised signed in without a real
 * Google account. The app calls it when opened with `?devSignIn`
 * (see `src/lib/devSignIn.ts`).
 *
 * Only `npm start` (vite.config.ts) loads this plugin; the phone preview uses its
 * own config and never exposes it. Requests must also come from this machine.
 */

const TOKEN_PATH = '/__dev/sign-in-token';
const TEST_USER = { uid: 'dev-test-user', displayName: 'Dev Tester' };
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const APP_NAME = 'dev-sign-in';

function hostnameOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return undefined;
  }
}

/** Same machine, addressed as localhost, not proxied, and not from another site. */
function isLocalRequest(req: IncomingMessage): boolean {
  const { headers, socket } = req;
  if (!LOOPBACK_ADDRESSES.has(socket.remoteAddress ?? '')) return false;
  if (headers['x-forwarded-for'] || headers['x-forwarded-host'] || headers.forwarded) return false;
  if (!LOCAL_HOSTNAMES.has(hostnameOf(headers.host) ?? '')) return false;
  return !headers.origin || LOCAL_HOSTNAMES.has(hostnameOf(headers.origin) ?? '');
}

async function getAdminAuth() {
  const { cert, getApp, getApps, initializeApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');

  if (!getApps().some((app) => app.name === APP_NAME)) {
    const keyPath = resolve(process.cwd(), 'service-account.json');
    if (!existsSync(keyPath)) {
      throw new Error('service-account.json not found in the project root.');
    }
    initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf-8'))) }, APP_NAME);
  }
  return getAuth(getApp(APP_NAME));
}

async function mintTestUserToken(): Promise<string> {
  const auth = await getAdminAuth();

  const user = await auth.getUser(TEST_USER.uid).catch((error: { code?: string }) => {
    if (error.code === 'auth/user-not-found') return auth.createUser(TEST_USER);
    throw error;
  });
  if (user.customClaims?.admin) {
    throw new Error(`${TEST_USER.uid} has an admin claim; remove it before using dev sign-in.`);
  }

  return auth.createCustomToken(TEST_USER.uid);
}

export function devSignInPlugin(): Plugin {
  return {
    name: 'dev-sign-in',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(TOKEN_PATH, (req, res) => {
        if (req.method !== 'POST' || !isLocalRequest(req)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        mintTestUserToken().then(
          (token) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify({ token }));
          },
          (error: Error) => {
            res.statusCode = 500;
            res.end(error.message);
          }
        );
      });
    },
  };
}
