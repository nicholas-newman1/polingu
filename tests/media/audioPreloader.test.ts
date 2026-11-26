import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  clearAudioCache,
  formatCacheSize,
  getAudioCacheCount,
  getAudioCacheSize,
  preloadAudioFiles,
  type PreloadProgress,
} from '../../src/lib/audioPreloader';

/** In-memory Cache API: `cache.add(url)` "downloads" unless the URL is in `unreachable`. */
class FakeCache {
  readonly entries = new Set<string>();
  readonly downloaded: string[] = [];
  readonly unreachable = new Set<string>();
  /** How many bytes each URL's file holds (none if unset). */
  readonly fileSizes = new Map<string, number>();

  async match(request: string | { url: string }) {
    const url = typeof request === 'string' ? request : request.url;
    return this.entries.has(url)
      ? new Response(new Uint8Array(this.fileSizes.get(url) ?? 0))
      : undefined;
  }

  async add(url: string) {
    if (this.unreachable.has(url)) throw new TypeError(`Failed to fetch ${url}`);
    this.downloaded.push(url);
    this.entries.add(url);
  }

  async keys() {
    return [...this.entries].map((url) => ({ url }));
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();

  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }

  async delete(name: string) {
    return this.stores.delete(name);
  }
}

let caches: FakeCacheStorage;
const audioCache = () => caches.open('polingu-audio');

beforeEach(() => {
  caches = new FakeCacheStorage();
  vi.stubGlobal('caches', caches);
});

describe('downloading audio for offline use', () => {
  test('stores every audio URL in the offline audio cache and reports progress after each', async () => {
    const progress: PreloadProgress[] = [];

    const stored = await preloadAudioFiles(
      [{ audioUrl: 'a.mp3' }, {}, { audioUrl: '' }, { audioUrl: 'b.mp3' }],
      (p) => progress.push(p)
    );

    expect(stored).toBe(2);
    expect((await audioCache()).downloaded).toEqual(['a.mp3', 'b.mp3']);
    expect(progress).toEqual([
      { loaded: 1, total: 2, currentUrl: 'a.mp3', failed: 0 },
      { loaded: 2, total: 2, currentUrl: 'b.mp3', failed: 0 },
    ]);
  });

  test('files already in the cache are counted but not downloaded again', async () => {
    (await audioCache()).entries.add('a.mp3');

    const stored = await preloadAudioFiles([{ audioUrl: 'a.mp3' }, { audioUrl: 'b.mp3' }]);

    expect(stored).toBe(2);
    expect((await audioCache()).downloaded).toEqual(['b.mp3']);
  });

  test('a file that fails to download is counted as failed and the rest still download', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (await audioCache()).unreachable.add('broken.mp3');
    const progress: PreloadProgress[] = [];

    const stored = await preloadAudioFiles(
      [{ audioUrl: 'broken.mp3' }, { audioUrl: 'ok.mp3' }],
      (p) => progress.push(p)
    );

    expect(stored).toBe(1);
    expect((await audioCache()).downloaded).toEqual(['ok.mp3']);
    expect(progress.at(-1)).toEqual({ loaded: 1, total: 2, currentUrl: 'ok.mp3', failed: 1 });
    expect(warn).toHaveBeenCalledWith('Failed to cache audio: broken.mp3', expect.any(TypeError));
  });

  test('with no audio to download it reports nothing and leaves the cache alone', async () => {
    const onProgress = vi.fn();

    expect(await preloadAudioFiles([{}, { audioUrl: '' }], onProgress)).toBe(0);

    expect(onProgress).not.toHaveBeenCalled();
    expect(caches.stores.size).toBe(0);
  });
});

describe('offline audio cache stats', () => {
  test('counts the files in the offline audio cache only', async () => {
    await preloadAudioFiles([{ audioUrl: 'a.mp3' }, { audioUrl: 'b.mp3' }]);
    (await caches.open('workbox-precache')).entries.add('index.html');

    expect(await getAudioCacheCount()).toBe(2);
  });

  test('counts zero when the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined);

    expect(await getAudioCacheCount()).toBe(0);
  });

  test('sizes the files in the offline audio cache only, not everything the site stores', async () => {
    const precache = await caches.open('workbox-precache');
    precache.entries.add('index.html');
    precache.fileSizes.set('index.html', 700);
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ usage: 5_000_000 }) },
    });
    const cache = await audioCache();
    cache.fileSizes.set('a.mp3', 1500);
    cache.fileSizes.set('b.mp3', 2500);
    await preloadAudioFiles([{ audioUrl: 'a.mp3' }, { audioUrl: 'b.mp3' }]);

    expect(await getAudioCacheSize()).toBe(4000);
  });

  test('after clearing, the offline audio cache is reported as empty', async () => {
    const siteDataOutsideAudioCache = 5_000_000;
    (await caches.open('workbox-precache')).entries.add('index.html');
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ usage: siteDataOutsideAudioCache }) },
    });
    await preloadAudioFiles([{ audioUrl: 'a.mp3' }, { audioUrl: 'b.mp3' }]);

    await clearAudioCache();

    expect([await getAudioCacheCount(), await getAudioCacheSize()]).toEqual([0, 0]);
  });

  test('sizes zero, without throwing, when the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined);

    expect(await getAudioCacheSize()).toBe(0);
  });
});

describe('clearing the offline audio cache', () => {
  test('removes every cached audio file', async () => {
    await preloadAudioFiles([{ audioUrl: 'a.mp3' }]);

    await clearAudioCache();

    expect(await getAudioCacheCount()).toBe(0);
  });

  test('leaves the app’s other offline files alone', async () => {
    (await caches.open('workbox-precache')).entries.add('index.html');
    await preloadAudioFiles([{ audioUrl: 'a.mp3' }]);

    await clearAudioCache();

    expect([...caches.stores.keys()]).toEqual(['workbox-precache']);
    expect([...(await caches.open('workbox-precache')).entries]).toEqual(['index.html']);
  });

  test('a failure is logged rather than thrown', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('SecurityError');
    vi.spyOn(caches, 'delete').mockRejectedValue(failure);

    await expect(clearAudioCache()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('Failed to clear audio cache:', failure);
  });
});

describe('formatting a cache size', () => {
  test.each([
    [0, '0 B'],
    [1, '1 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1 MB'],
    [3.25 * 1024 * 1024, '3.3 MB'],
    [1.2 * 1024 * 1024 * 1024, '1.2 GB'],
  ])('%d bytes reads as %s', (bytes, text) => {
    expect(formatCacheSize(bytes)).toBe(text);
  });
});
