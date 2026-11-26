/**
 * Stand-in for `firebase/functions`. Install it with
 *
 *   vi.mock('firebase/functions', () => import('./support/fakeFunctions'));
 *
 * and drive it through `server`:
 *   - `server.handle(name, handler)` answers calls to the callable `name`.
 *     A handler may throw to make the call reject.
 *   - `server.calls` records every call as `{ name, data }`.
 * Calling a callable with no handler rejects with `functions/not-found`.
 * Callables are looked up when called, so modules may create them at import time.
 * Request data is encoded as the SDK encodes it, so the server (and `server.calls`)
 * sees `null` for a missing argument or an `undefined` field.
 */

type Handler = (data: unknown) => unknown;

/** The SDK's encoding of callable data (`encode` in @firebase/functions). */
function encode(data: unknown): unknown {
  if (data === null || data === undefined) return null;
  if (typeof data === 'number' && Number.isFinite(data)) return data;
  if (typeof data === 'boolean' || typeof data === 'string') return data;
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(encode);
  if (typeof data === 'object') {
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)]));
  }
  throw new Error(`Data cannot be encoded in JSON: ${String(data)}`);
}

export class FunctionsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'FirebaseError';
  }
}

class FakeFunctionsServer {
  readonly calls: Array<{ name: string; data: unknown }> = [];
  private handlers = new Map<string, Handler>();

  reset() {
    this.calls.length = 0;
    this.handlers.clear();
  }

  handle(name: string, handler: Handler) {
    this.handlers.set(name, handler);
  }

  /** The data of every call to `name`, in order. */
  callsTo(name: string): unknown[] {
    return this.calls.filter((c) => c.name === name).map((c) => c.data);
  }

  async invoke(name: string, data: unknown): Promise<unknown> {
    const encoded = encode(data);
    // Let the caller's synchronous code finish first, as a real network call would.
    await Promise.resolve();
    this.calls.push({ name, data: encoded });
    const handler = this.handlers.get(name);
    if (!handler) throw new FunctionsError('functions/not-found', `No callable named ${name}`);
    return handler(encoded);
  }
}

export const server = new FakeFunctionsServer();

export function getFunctions(): { __fake: 'functions' } {
  return { __fake: 'functions' };
}

export function httpsCallable(_functions: unknown, name: string) {
  return async (data?: unknown) => ({ data: await server.invoke(name, data) });
}
