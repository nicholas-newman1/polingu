/**
 * Stand-in for `firebase/functions`. Every callable resolves `{ data: {} }` unless a
 * test sets `callables.handle` to answer differently.
 *
 *   vi.mock('firebase/functions', () => import('./support/firebaseFunctions'));
 */
import { vi } from 'vitest';

type Handler = (name: string, data: unknown) => Promise<{ data: unknown }>;

const defaultHandler: Handler = async () => ({ data: {} });

export const callables = {
  /** Every call made, as `[name, data]`. */
  calls: vi.fn<(name: string, data: unknown) => void>(),
  handle: defaultHandler,
  reset() {
    this.calls.mockReset();
    this.handle = defaultHandler;
  },
};

export function httpsCallable(_functions: unknown, name: string) {
  return async (data: unknown) => {
    callables.calls(name, data);
    return callables.handle(name, data);
  };
}

export const getFunctions = () => ({});
