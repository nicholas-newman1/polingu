/**
 * Stand-in for the `firebase/functions` SDK. Install it in a test file with
 *
 *   vi.mock('firebase/functions', () => import('./support/fakeFunctions'));
 *
 * The app creates its callables at import time with httpsCallable(functions, name).
 * Each one forwards to the handler a test installs with `serveCallable(name, ...)`,
 * so the real client wrappers (src/lib/translate.ts and friends) run unchanged.
 * A callable with no handler rejects, so a test never reaches a server by accident.
 */
import { vi } from 'vitest';

type Handler = (data: unknown) => Promise<unknown>;

const handlers = new Map<string, Handler>();

export const getFunctions = () => ({ __fake: 'functions' });

export function httpsCallable(_functions: unknown, name: string) {
  return async (data: unknown) => {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`No fake server for callable "${name}"`);
    return { data: await handler(data) };
  };
}

/**
 * Installs the server side of callable `name`. `impl` receives the request payload
 * and returns the response payload (or throws, as an HttpsError would surface).
 * Returns the mock so tests can read what was sent.
 */
export function serveCallable<Req, Res>(name: string, impl: (data: Req) => Res | Promise<Res>) {
  const fn = vi.fn(async (data: unknown) => impl(data as Req));
  handlers.set(name, fn);
  return fn;
}

export function resetCallables() {
  handlers.clear();
}
