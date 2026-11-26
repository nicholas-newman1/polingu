import { Blob as NodeBlob } from 'node:buffer';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { cacheAudioBlob, getCachedAudioBlob } from '../../src/lib/audio';
import { clearAudioBlobStore } from './support/audioBlobStore';

// jsdom's Blob does not survive IndexedDB's structured clone; Node's does, like a browser's.
const audio = (content: string, type = 'audio/mpeg') =>
  new NodeBlob([content], { type }) as unknown as Blob;

/** An IDBRequest stand-in that fails on the next tick, as a browser reports a failed read or write. */
function failingRequest(name: string, message: string) {
  const request: { error: DOMException | null; onsuccess?: () => void; onerror?: () => void } = {
    error: null,
  };
  setTimeout(() => {
    request.error = new DOMException(message, name);
    request.onerror?.();
  }, 0);
  return request as unknown as IDBRequest;
}

beforeEach(clearAudioBlobStore);

describe('offline audio blob cache', () => {
  test('misses for audio that was never cached', async () => {
    expect(await getCachedAudioBlob('unknown')).toBeNull();
  });

  test('returns the cached audio with its content and type', async () => {
    await cacheAudioBlob('a1', audio('first take', 'audio/ogg'));

    const cached = await getCachedAudioBlob('a1');

    expect(cached?.type).toBe('audio/ogg');
    expect(await cached?.text()).toBe('first take');
  });

  test('caching again under the same key replaces the old audio', async () => {
    await cacheAudioBlob('a1', audio('first take'));
    await cacheAudioBlob('a1', audio('second take'));

    expect(await (await getCachedAudioBlob('a1'))?.text()).toBe('second take');
  });

  test('keeps a separate entry for each key', async () => {
    await cacheAudioBlob('a1', audio('one'));
    await cacheAudioBlob('a2', audio('two'));

    expect(await (await getCachedAudioBlob('a1'))?.text()).toBe('one');
    expect(await (await getCachedAudioBlob('a2'))?.text()).toBe('two');
  });

  test('when IndexedDB is unavailable, reads miss and writes are skipped without errors', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });

    await expect(cacheAudioBlob('a1', audio('x'))).resolves.toBeUndefined();
    await expect(getCachedAudioBlob('a1')).resolves.toBeNull();
  });

  test('when the database fails to open, reads miss and writes are skipped without errors', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => failingRequest('UnknownError', 'Internal error opening backing store'),
    });

    await expect(cacheAudioBlob('a1', audio('x'))).resolves.toBeUndefined();
    await expect(getCachedAudioBlob('a1')).resolves.toBeNull();
  });

  describe('when reading a stored blob fails after the database opened', () => {
    /** Caches a blob, then makes every read of the store fail as a browser reports it. */
    async function cacheThenBreakReads() {
      await cacheAudioBlob('a1', audio('x'));
      return vi
        .spyOn(IDBObjectStore.prototype, 'get')
        .mockImplementation(() =>
          failingRequest('UnknownError', 'Failed to read large IndexedDB value')
        );
    }

    /** Settles `promise` into a value or an error, so either can be asserted on. */
    const outcomeOf = <T>(promise: Promise<T>) =>
      promise.then(
        (value) => ({ value }),
        (error: unknown) => ({ error })
      );

    // Proves the injected failure is what the read runs into, so the test that follows
    // covers a read that really failed.
    test('the stored blob is never returned', async () => {
      const get = await cacheThenBreakReads();

      const outcome = await outcomeOf(getCachedAudioBlob('a1'));

      expect(get).toHaveBeenCalledWith('a1');
      expect('value' in outcome ? outcome.value : null).toBeNull();
    });

    test('it is treated as a miss', async () => {
      await cacheThenBreakReads();

      expect(await outcomeOf(getCachedAudioBlob('a1'))).toEqual({ value: null });
    });
  });
});
