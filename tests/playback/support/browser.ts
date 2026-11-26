/**
 * Browser APIs jsdom lacks, installed per test and removed afterwards:
 * ResizeObserver, IntersectionObserver, Element.scrollIntoView,
 * URL.createObjectURL / revokeObjectURL, and (opt-in) the Media Session API.
 */
import { afterEach, beforeEach, vi } from 'vitest';

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

export const objectUrls = {
  created: [] as string[],
  revoked: [] as string[],
};

export interface FakeMediaSession {
  metadata: { title?: string; artist?: string } | null;
  setActionHandler: ReturnType<typeof vi.fn>;
  setPositionState: ReturnType<typeof vi.fn>;
  /** Runs the handler the app registered for a lock-screen / headset action. */
  trigger: (action: string, details?: Record<string, unknown>) => void;
}

function restore(target: object, key: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(target, key, descriptor);
  else delete (target as Record<string, unknown>)[key];
}

/** Installs the stubs every playback test needs. Call once at the top of a file. */
export function setupBrowser() {
  let scrollDescriptor: PropertyDescriptor | undefined;
  let createDescriptor: PropertyDescriptor | undefined;
  let revokeDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', NoopObserver);
    vi.stubGlobal('IntersectionObserver', NoopObserver);

    scrollDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    Element.prototype.scrollIntoView = vi.fn();

    createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    objectUrls.created.length = 0;
    objectUrls.revoked.length = 0;
    let next = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => {
        const url = `blob:polingu/${++next}`;
        objectUrls.created.push(url);
        return url;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => {
        objectUrls.revoked.push(url);
      },
    });
  });

  afterEach(() => {
    restore(Element.prototype, 'scrollIntoView', scrollDescriptor);
    restore(URL, 'createObjectURL', createDescriptor);
    restore(URL, 'revokeObjectURL', revokeDescriptor);
    Reflect.deleteProperty(navigator, 'mediaSession');
  });
}

/** Gives `navigator` a Media Session for the rest of the test. */
export function installMediaSession(): FakeMediaSession {
  const handlers = new Map<string, (details: Record<string, unknown>) => void>();
  const session: FakeMediaSession = {
    metadata: null,
    setActionHandler: vi.fn((action: string, handler: (d: Record<string, unknown>) => void) => {
      handlers.set(action, handler);
    }),
    setPositionState: vi.fn(),
    trigger: (action, details = {}) => {
      const handler = handlers.get(action);
      if (!handler) throw new Error(`No media session handler for ${action}`);
      handler({ action, ...details });
    },
  };
  Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: session });
  vi.stubGlobal(
    'MediaMetadata',
    class {
      constructor(init: object) {
        Object.assign(this, init);
      }
    }
  );
  return session;
}
