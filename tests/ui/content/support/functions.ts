/**
 * Stand-in for `firebase/functions`. Callables are looked up by name when they are
 * called, so modules that create them at import time still see each test's handlers.
 *
 *   vi.mock('firebase/functions', () => import('./support/functions'));
 *
 * A callable with no handler rejects, like an unreachable Cloud Function.
 */
type Handler = (data: never) => unknown;

class Callables {
  private handlers = new Map<string, Handler>();
  readonly calls: Array<{ name: string; data: unknown }> = [];

  /** Answer calls to `name` with `handler`'s result (throw in it to make the call fail). */
  set<TData = unknown>(name: string, handler: (data: TData) => unknown) {
    this.handlers.set(name, handler as Handler);
  }

  get(name: string): Handler | undefined {
    return this.handlers.get(name);
  }

  /** The request data of every call made to `name`, in order. */
  callsTo(name: string): unknown[] {
    return this.calls.filter((c) => c.name === name).map((c) => c.data);
  }

  reset() {
    this.handlers.clear();
    this.calls.length = 0;
  }
}

export const callables = new Callables();

export function getFunctions() {
  return { __fake: 'functions' };
}

export function httpsCallable(_functions: unknown, name: string) {
  return async (data?: unknown) => {
    callables.calls.push({ name, data });
    const handler = callables.get(name);
    if (!handler) throw new Error(`Unmocked callable: ${name}`);
    return { data: await handler(data as never) };
  };
}
