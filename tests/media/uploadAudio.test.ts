import { File as NodeFile } from 'node:buffer';
import { describe, expect, test, vi } from 'vitest';
import { getCachedAudioBlob, uploadAudio } from '../../src/lib/audio';
import type { AudioUploadProgress } from '../../src/types/audio';
import { remote } from './support/fakeFirestore';
import { bucket, StorageError } from './support/fakeStorage';
import {
  fileOfSize,
  flushMicrotasks,
  MB,
  setupMediaTests,
  signIn,
  userPath,
} from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));
vi.mock('firebase/storage', () => import('./support/fakeStorage'));

setupMediaTests();

const UID = 'learner-a';
const PENDING_PATH = new RegExp(`^audio/users/${UID}/pending/([0-9a-f-]{36})/(.+)$`);

function startUpload(file: File = fileOfSize('Lekcja 1.mp3', 'audio/mpeg', 1000)) {
  const progress: AudioUploadProgress[] = [];
  let settled = false;
  const result = uploadAudio(file, (p) => progress.push(p));
  result.then(
    () => (settled = true),
    () => (settled = true)
  );
  const upload = bucket.onlyUpload;
  const audioId = PENDING_PATH.exec(upload.path)?.[1] ?? '';
  return {
    result,
    upload,
    audioId,
    progress,
    statuses: () => progress.map((p) => p.status),
    isSettled: () => settled,
    itemPath: userPath(UID, 'audioItems', audioId),
  };
}

describe('uploading an audio file', () => {
  test('sends the file to the user’s pending folder under a fresh id, keeping its name', async () => {
    signIn(UID);
    const file = fileOfSize('Lekcja 1.mp3', 'audio/mpeg', 1000);
    const { upload, audioId } = startUpload(file);

    expect(upload.path).toBe(`audio/users/${UID}/pending/${audioId}/Lekcja 1.mp3`);
    expect(upload.data).toBe(file);

    const second = startUploadAfter(file);
    expect(second).not.toBe(audioId);
  });

  test('reports the upload percentage as bytes are sent', () => {
    signIn(UID);
    const { upload, progress, audioId } = startUpload(fileOfSize('a.mp3', 'audio/mpeg', 1000));

    upload.progress(250);
    upload.progress(1000);

    expect(progress).toEqual([
      { status: 'uploading', uploadPercent: 25, audioId },
      { status: 'uploading', uploadPercent: 100, audioId },
    ]);
  });

  test('after the upload it reports processing, then resolves with the id once the server marks it ready', async () => {
    signIn(UID);
    const { upload, result, audioId, statuses, itemPath, progress } = startUpload();

    upload.finish();
    expect(statuses()).toEqual(['processing']);

    remote.seed(itemPath, { id: audioId, status: 'ready', createdAt: 1 });

    await expect(result).resolves.toBe(audioId);
    expect(progress.at(-1)).toEqual({ status: 'ready', audioId });
    expect(remote.listenerCount).toBe(0);
  });

  test('waits through intermediate server updates until processing finishes', async () => {
    signIn(UID);
    const { upload, result, audioId, isSettled, itemPath, statuses } = startUpload();
    upload.finish();

    remote.seed(itemPath, { id: audioId, status: 'processing', createdAt: 1 });
    await flushMicrotasks();
    expect(isSettled()).toBe(false);
    expect(statuses()).toEqual(['processing']);

    remote.seed(itemPath, { id: audioId, status: 'ready', createdAt: 1 });
    await expect(result).resolves.toBe(audioId);
  });

  test('rejects with the server’s message when processing fails', async () => {
    signIn(UID);
    const { upload, result, audioId, itemPath, progress } = startUpload();
    upload.finish();

    remote.seed(itemPath, { id: audioId, status: 'error', error: 'No speech found.' });

    await expect(result).rejects.toThrow('No speech found.');
    expect(progress.at(-1)).toEqual({ status: 'error', error: 'No speech found.', audioId });
    expect(remote.listenerCount).toBe(0);
  });

  test('a failed upload is reported and rejects with the storage error, without waiting for processing', async () => {
    signIn(UID);
    const { upload, result, audioId, progress } = startUpload();
    const error = new StorageError('storage/quota-exceeded', 'Quota exceeded.');

    upload.fail(error);

    await expect(result).rejects.toBe(error);
    expect(progress).toEqual([{ status: 'error', error: 'Quota exceeded.', audioId }]);
    expect(remote.listenerCount).toBe(0);
  });

  test('gives up after ten minutes of processing and stops listening', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    signIn(UID);
    const { upload, result, isSettled } = startUpload();
    upload.finish();
    await flushMicrotasks();

    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    await flushMicrotasks();
    expect(isSettled()).toBe(false);

    vi.advanceTimersByTime(1);
    await expect(result).rejects.toThrow('Processing timed out. Please try again.');
    expect(remote.listenerCount).toBe(0);
  });

  test('keeps a local copy of the uploaded file so it plays without downloading', async () => {
    signIn(UID);
    const file = new NodeFile(['ID3 audio bytes'], 'clip.mp3', { type: 'audio/mpeg' });
    const { upload, audioId } = startUpload(file as unknown as File);

    expect(await getCachedAudioBlob(audioId)).toBeNull();
    upload.finish();

    await vi.waitFor(async () => {
      const cached = await getCachedAudioBlob(audioId);
      expect(await cached?.text()).toBe('ID3 audio bytes');
    });
  });

  test('the upload still succeeds when the local copy cannot be stored', async () => {
    signIn(UID);
    // A file IndexedDB can store (jsdom's File cannot be cloned into it at all), so the
    // injected quota failure is the only thing stopping the local copy.
    const file = new NodeFile(['ID3 audio bytes'], 'clip.mp3', { type: 'audio/mpeg' });
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const { upload, result, audioId, itemPath } = startUpload(file as unknown as File);

    upload.finish();
    remote.seed(itemPath, { id: audioId, status: 'ready', createdAt: 1 });

    await expect(result).resolves.toBe(audioId);
    await vi.waitFor(() => expect(put).toHaveBeenCalledWith(file, audioId));
    expect(await getCachedAudioBlob(audioId)).toBeNull();
  });
});

describe('validation before uploading', () => {
  test.each([
    ['talk.mp3', 'audio/mpeg'],
    ['TALK.WAV', ''],
    ['memo.M4A', 'application/octet-stream'],
    ['recording', 'audio/ogg'],
    ['song.flac', 'audio/x-flac'],
    ['voice.m4a', 'audio/x-m4a'],
  ])('accepts %s (%s)', (name, type) => {
    signIn(UID);
    uploadAudio(fileOfSize(name, type, 1000), () => {});

    expect(bucket.onlyUpload.path).toMatch(PENDING_PATH);
    expect(bucket.onlyUpload.path.endsWith(`/${name}`)).toBe(true);
  });

  test.each([
    ['notes.txt', 'text/plain'],
    ['clip.webm', 'audio/webm'],
    ['movie.mp4', 'video/mp4'],
    ['no-extension', ''],
    ['mp3', ''],
  ])('rejects %s (%s) as an unsupported format without uploading', async (name, type) => {
    signIn(UID);
    const onProgress = vi.fn();

    await expect(uploadAudio(fileOfSize(name, type, 1000), onProgress)).rejects.toThrow(
      'Unsupported format. Use MP3, WAV, OGG, FLAC, or M4A.'
    );
    expect(bucket.uploads).toEqual([]);
    expect(onProgress).not.toHaveBeenCalled();
  });

  test('accepts a file of exactly 25 MB and rejects anything larger without uploading', async () => {
    signIn(UID);
    uploadAudio(fileOfSize('max.mp3', 'audio/mpeg', 25 * MB), () => {});
    expect(bucket.uploads).toHaveLength(1);

    await expect(
      uploadAudio(fileOfSize('big.mp3', 'audio/mpeg', 25 * MB + 1), () => {})
    ).rejects.toThrow('File too large. Maximum size is 25MB.');
    expect(bucket.uploads).toHaveLength(1);
  });

  test('requires a signed-in user', async () => {
    await expect(uploadAudio(fileOfSize('a.mp3', 'audio/mpeg', 10), () => {})).rejects.toThrow(
      'Not authenticated'
    );
    expect(bucket.uploads).toEqual([]);
  });
});

/** Starts another upload of `file` and returns its id. */
function startUploadAfter(file: File): string {
  uploadAudio(file, () => {});
  return PENDING_PATH.exec(bucket.uploads.at(-1)!.path)?.[1] ?? '';
}
