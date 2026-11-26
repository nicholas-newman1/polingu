import { beforeEach, describe, expect, test, vi } from 'vitest';
import { deferred } from '../hooks/support/deferred';
import { flushMicrotasks } from './support/async';

// The cache lives in module state, so every test loads a fresh copy.
async function loadCache() {
  vi.resetModules();
  return import('../../src/lib/audio/audioPrefetchCache');
}

const url = (n: number) => `https://cdn.test/audio/${n}.mp3`;

type FetchResult = { ok: boolean; blob: () => Promise<Blob> };

let fetchMock: ReturnType<typeof vi.fn<(input: string) => Promise<FetchResult>>>;
let objectUrls: Map<string, Blob>;
let revoked: string[];

/** Records each `<audio>` element the cache creates to warm the browser's media cache. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  preload = '';
  src = '';
  load = vi.fn();
  private listeners = new Map<string, Set<() => void>>();

  constructor() {
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0);
  }
}

/** The object URL created for the file fetched from `source`. */
async function objectUrlOf(source: string) {
  for (const [objectUrl, blob] of objectUrls) if ((await blob.text()) === source) return objectUrl;
  throw new Error(`No object URL for ${source}`);
}

const okResponse = (body: string): FetchResult => ({
  ok: true,
  blob: async () => new Blob([body], { type: 'audio/mpeg' }),
});

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal('Audio', FakeAudio);
  fetchMock = vi.fn(async (input: string) => okResponse(input));
  vi.stubGlobal('fetch', fetchMock);
  objectUrls = new Map();
  revoked = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    const objectUrl = `blob:polingu/${objectUrls.size + 1}`;
    objectUrls.set(objectUrl, blob as Blob);
    return objectUrl;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((objectUrl) => {
    revoked.push(objectUrl);
  });
});

describe('prefetched audio', () => {
  test('without a URL there is nothing to play; unprefetched audio plays from its URL', async () => {
    const { resolvePlayableAudioUrl } = await loadCache();

    expect(resolvePlayableAudioUrl(null)).toBeUndefined();
    expect(resolvePlayableAudioUrl(undefined)).toBeUndefined();
    expect(resolvePlayableAudioUrl('')).toBeUndefined();
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
  });

  test('once prefetched, plays from an in-memory copy of the fetched file', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();

    prefetchAudio(url(1));
    await flushMicrotasks();

    const playable = resolvePlayableAudioUrl(url(1))!;
    expect(playable).toMatch(/^blob:/);
    expect(await objectUrls.get(playable)?.text()).toBe(url(1));
    expect(fetchMock).toHaveBeenCalledWith(url(1));
  });

  test('missing URLs are ignored', async () => {
    const { prefetchAudio } = await loadCache();

    prefetchAudio(null);
    prefetchAudio(undefined);
    prefetchAudio('');
    await flushMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('audio already cached is not fetched again', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    prefetchAudio(url(1));
    await flushMicrotasks();
    const playable = resolvePlayableAudioUrl(url(1));

    prefetchAudio(url(1));
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolvePlayableAudioUrl(url(1))).toBe(playable);
  });

  test('asking again while the first fetch is still running does not start a second fetch', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    const response = deferred<FetchResult>();
    fetchMock.mockReturnValueOnce(response.promise);

    prefetchAudio(url(1));
    prefetchAudio(url(1));
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
    response.resolve(okResponse('body'));
    await flushMicrotasks();
    prefetchAudio(url(1));
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(resolvePlayableAudioUrl(url(1))).toMatch(/^blob:/);
  });

  test('keeps at most 20 files, dropping and releasing the oldest first', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    for (let n = 0; n < 20; n++) prefetchAudio(url(n));
    await flushMicrotasks();
    const oldest = await objectUrlOf(url(0));
    expect(revoked).toEqual([]);

    prefetchAudio(url(20));
    await flushMicrotasks();

    expect(objectUrls.size).toBe(21);
    expect(revoked).toEqual([oldest]);
    expect(resolvePlayableAudioUrl(url(0))).toBe(url(0));
    for (let n = 1; n <= 20; n++) expect(resolvePlayableAudioUrl(url(n))).toMatch(/^blob:/);
  });

  test('playing a file marks it recently used, so it outlives files that were not played', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    for (let n = 0; n < 20; n++) prefetchAudio(url(n));
    await flushMicrotasks();

    resolvePlayableAudioUrl(url(0));
    prefetchAudio(url(20));
    await flushMicrotasks();

    expect(resolvePlayableAudioUrl(url(0))).toMatch(/^blob:/);
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
  });

  test('prefetching a cached file again also marks it recently used', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    for (let n = 0; n < 20; n++) prefetchAudio(url(n));
    await flushMicrotasks();

    prefetchAudio(url(0));
    prefetchAudio(url(20));
    await flushMicrotasks();

    expect(resolvePlayableAudioUrl(url(0))).toMatch(/^blob:/);
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
    expect(fetchMock).toHaveBeenCalledTimes(21);
  });
});

describe('when the file cannot be fetched', () => {
  test('a refused response warms the browser’s media cache with a preloading audio element', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    fetchMock.mockResolvedValueOnce({ ok: false, blob: async () => new Blob() });

    prefetchAudio(url(1));
    await flushMicrotasks();

    expect(FakeAudio.instances).toHaveLength(1);
    const [element] = FakeAudio.instances;
    expect(element.preload).toBe('auto');
    expect(element.src).toBe(url(1));
    expect(element.load).toHaveBeenCalledTimes(1);
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  test('a network or CORS error falls back the same way, warming each URL only once', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    prefetchAudio(url(1));
    await flushMicrotasks();
    prefetchAudio(url(1));
    await flushMicrotasks();
    prefetchAudio(url(2));
    await flushMicrotasks();

    expect(FakeAudio.instances.map((a) => a.src)).toEqual([url(1), url(2)]);
    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
  });

  test('the warm-up element is let go once it can play through, or once it fails', async () => {
    const { prefetchAudio } = await loadCache();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    prefetchAudio(url(1));
    prefetchAudio(url(2));
    await flushMicrotasks();
    const [loaded, failed] = FakeAudio.instances;
    expect(loaded.listenerCount).toBeGreaterThan(0);

    loaded.emit('canplaythrough');
    failed.emit('error');

    expect(loaded.listenerCount).toBe(0);
    expect(failed.listenerCount).toBe(0);
  });

  test('if even the fallback element cannot be created, prefetching fails quietly', async () => {
    const { prefetchAudio, resolvePlayableAudioUrl } = await loadCache();
    vi.stubGlobal(
      'Audio',
      class {
        constructor() {
          throw new Error('Media playback is disabled');
        }
      }
    );
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    expect(() => prefetchAudio(url(1))).not.toThrow();
    await flushMicrotasks();

    expect(resolvePlayableAudioUrl(url(1))).toBe(url(1));
  });
});
