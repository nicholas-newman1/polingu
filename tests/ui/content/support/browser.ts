/**
 * Browser APIs jsdom lacks, installed fresh for each test by `installBrowserStubs()`:
 * matchMedia (driven by `screenSize`), ResizeObserver, a controllable
 * IntersectionObserver, visualViewport, scrolling, media playback, the Cache API
 * used for offline audio, and navigator.storage.
 */
import { vi } from 'vitest';

/** What media queries see. Desktop by default, so the side navigation is always shown. */
export const screenSize = {
  width: 1280,
  coarsePointer: false,
};

function featureMatches(feature: string): boolean {
  const [name, rawValue] = feature.split(':').map((s) => s.trim());
  const value = rawValue ?? '';
  switch (name) {
    case 'min-width':
      return screenSize.width >= parseFloat(value);
    case 'max-width':
      return screenSize.width <= parseFloat(value);
    case 'prefers-reduced-motion':
      return value === 'reduce';
    case 'prefers-color-scheme':
      return value === 'light';
    case 'any-pointer':
    case 'pointer':
      return screenSize.coarsePointer ? value === 'coarse' : value === 'fine';
    case 'hover':
      return !screenSize.coarsePointer;
    default:
      return false;
  }
}

function queryMatches(query: string): boolean {
  const features = query
    .replace(/^@media\s*/, '')
    .split(/\band\b/)
    .map((part) => part.trim().replace(/^\(|\)$/g, ''))
    .filter(Boolean);
  return features.length > 0 && features.every(featureMatches);
}

function matchMedia(query: string): MediaQueryList {
  return {
    matches: queryMatches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** IntersectionObserver whose entries the test delivers with `intersect()`. */
export class FakeIntersectionObserver {
  static readonly instances = new Set<FakeIntersectionObserver>();
  readonly elements = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  readonly rootMargin: string;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.rootMargin = options?.rootMargin ?? '0px';
    FakeIntersectionObserver.instances.add(this);
  }

  observe(el: Element) {
    this.elements.add(el);
  }

  unobserve(el: Element) {
    this.elements.delete(el);
  }

  disconnect() {
    this.elements.clear();
    FakeIntersectionObserver.instances.delete(this);
  }

  takeRecords() {
    return [];
  }
}

/** Report `elements` entering (or leaving) the viewport to every observer watching them. */
export function intersect(elements: Element[], isIntersecting: boolean) {
  for (const observer of [...FakeIntersectionObserver.instances]) {
    const entries = elements
      .filter((el) => observer.elements.has(el))
      .map(
        (target) =>
          ({
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
          }) as unknown as IntersectionObserverEntry
      );
    if (entries.length > 0) {
      observer.callback(entries, observer as unknown as IntersectionObserver);
    }
  }
}

class FakeVisualViewport extends EventTarget {
  height = 800;
  width = 1280;
  offsetTop = 0;
  offsetLeft = 0;
  scale = 1;
}

/** The on-screen keyboard and pinch zoom, as `window.visualViewport` reports them. */
export let visualViewport = new FakeVisualViewport();

/** Offline audio files saved with the Cache API, by cache name. */
export const audioCaches = {
  stores: new Map<string, Set<string>>(),
  /** URLs whose download fails. */
  failing: new Set<string>(),
  /** What navigator.storage.estimate() reports as used (all site data, not just audio). */
  usageBytes: 0,
  /** Size of each cached file's body, by URL; files without an entry are empty. */
  fileBytes: new Map<string, number>(),
};

function cacheFor(name: string) {
  if (!audioCaches.stores.has(name)) audioCaches.stores.set(name, new Set());
  const urls = audioCaches.stores.get(name)!;
  return {
    match: async (request: string | { url: string }) => {
      const url = typeof request === 'string' ? request : request.url;
      if (!urls.has(url)) return undefined;
      return new Response(new Uint8Array(audioCaches.fileBytes.get(url) ?? 0));
    },
    add: async (url: string) => {
      if (audioCaches.failing.has(url)) throw new Error(`Failed to fetch ${url}`);
      urls.add(url);
    },
    keys: async () => [...urls].map((url) => ({ url })),
  };
}

const fakeCaches = {
  open: async (name: string) => cacheFor(name),
  delete: async (name: string) => audioCaches.stores.delete(name),
};

Object.defineProperty(window.navigator, 'storage', {
  configurable: true,
  get: () => ({ estimate: async () => ({ usage: audioCaches.usageBytes, quota: 1e10 }) }),
});

export function installBrowserStubs() {
  screenSize.width = 1280;
  screenSize.coarsePointer = false;
  visualViewport = new FakeVisualViewport();
  FakeIntersectionObserver.instances.clear();
  audioCaches.stores.clear();
  audioCaches.failing.clear();
  audioCaches.usageBytes = 0;
  audioCaches.fileBytes.clear();

  vi.stubGlobal('matchMedia', matchMedia);
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal('visualViewport', visualViewport);
  vi.stubGlobal('caches', fakeCaches);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  // Deleting asks for confirmation; tests that care answer it themselves.
  vi.spyOn(window, 'confirm').mockReturnValue(true);
}
