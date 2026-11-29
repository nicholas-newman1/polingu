/**
 * Admin audio tools: previewing and saving card audio, and creating or deleting
 * system listening items. Access control is covered in adminOnly.test.ts.
 */
import { describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { generateAudioPreview } from '../../src/callables/generateAudioPreview.js';
import { saveAudio } from '../../src/callables/saveAudio.js';
import { createSystemAudio } from '../../src/callables/createSystemAudio.js';
import { deleteSystemAudio } from '../../src/callables/deleteSystemAudio.js';
import { AUDIO_BUCKET, DEFAULT_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, storage, tasks, tts } from '../support/sdk.js';
import { call } from '../support/invoke.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/functions', () =>
  import('../support/sdk.js').then((m) => m.adminFunctions)
);
vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));

installFakes();

const admin = createUser('admin-1', { admin: true });

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(HttpsError);
  return error as HttpsError;
}

describe('generateAudioPreview', () => {
  const ask = (data: Record<string, unknown>) => call(generateAudioPreview, data as never, admin);

  test('returns the synthesized audio as base64 without saving anything', async () => {
    const result = await ask({ text: 'Dzień dobry', type: 'sentence' });

    expect(Buffer.from(result.audioBase64, 'base64').toString()).toBe('mp3(Dzień dobry)');
    expect(storage.files.size).toBe(0);
    expect(db.writes).toEqual([]);
  });

  test.each([
    ['no text', {}],
    ['non-string text', { text: 7 }],
    ['text over 1000 characters', { text: 'a'.repeat(1001) }],
  ])('rejects %s', async (_case, data) => {
    const error = await rejection(ask(data));
    expect(error).toMatchObject({ code: 'invalid-argument' });
    expect(tts.requests).toHaveLength(0);
  });

  test.each([
    ['a TTS failure', () => new Error('quota')],
    ['empty TTS audio', () => null],
  ])('turns %s into an internal error', async (_case, respond) => {
    tts.respond = respond;
    const error = await rejection(ask({ text: 'Cześć', type: 'sentence' }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to generate audio.' });
  });
});

describe('saveAudio', () => {
  const mp3 = Buffer.from('edited mp3');
  const ask = (data: Record<string, unknown>) =>
    call(saveAudio, { audioBase64: mp3.toString('base64'), ...data } as never, admin);

  test('stores the audio and points the built-in card at it', async () => {
    db.seed('sentences/s1', { polish: 'Cześć', audioUrl: 'https://old' });

    const { audioUrl } = await ask({ type: 'sentence', id: 's1' });
    expect(storage.file(AUDIO_BUCKET, 'sentences/s1.mp3')?.data).toEqual(mp3);
    expect(db.data('sentences/s1')).toEqual({ polish: 'Cześć', audioUrl });
    expect(audioUrl).toMatch(
      /^https:\/\/storage\.googleapis\.com\/polingu-audio\/sentences\/s1\.mp3\?v=/
    );
  });

  test('updates a single conjugated form', async () => {
    db.seed('verbs/isc', { conjugations: { present: { '1sg': { pl: 'idę' } } } });

    const { audioUrl } = await ask({ type: 'conjugation', id: 'isc', subPath: 'isc_present_1sg' });
    expect(storage.file(AUDIO_BUCKET, 'conjugation/isc_present_1sg.mp3')).toBeDefined();
    expect(db.data('verbs/isc')).toEqual({
      conjugations: { present: { '1sg': { pl: 'idę', audioUrl } } },
    });
  });

  test('a form whose key contains an underscore is updated on the verb it was sent for', async () => {
    db.seed('verbs/isc_sie', { conjugations: { past: { '1sg_f': { pl: 'szłam się' } } } });
    db.seed('verbs/isc', { conjugations: {} });

    const { audioUrl } = await ask({
      type: 'conjugation',
      id: 'isc_sie',
      subPath: 'isc_sie_past_1sg_f',
    });
    expect(storage.file(AUDIO_BUCKET, 'conjugation/isc_sie_past_1sg_f.mp3')).toBeDefined();
    expect(db.data('verbs/isc_sie')).toEqual({
      conjugations: { past: { '1sg_f': { pl: 'szłam się', audioUrl } } },
    });
    expect(db.data('verbs/isc')).toEqual({ conjugations: {} });
  });

  test.each([
    ['no sub-path', {}],
    ['a sub-path of another verb', { subPath: 'robic_present_1sg' }],
    ['a sub-path without a form key', { subPath: 'isc_present' }],
  ])('rejects conjugation audio with %s and saves nothing', async (_case, data) => {
    db.seed('verbs/isc', { conjugations: { present: { '1sg': { pl: 'idę' } } } });

    const error = await rejection(ask({ type: 'conjugation', id: 'isc', ...data }));
    expect(error).toMatchObject({
      code: 'invalid-argument',
      message: 'Sub-path must name a form of this verb.',
    });
    expect(storage.files.size).toBe(0);
    expect(db.writes).toEqual([]);
  });

  test('saves custom card audio under the calling admin’s own cards', async () => {
    db.seed(`users/${admin.uid}/customSentences/c1`, { polish: 'Cześć' });

    const { audioUrl } = await ask({ type: 'custom-sentence', id: 'c1' });
    expect(
      storage.file(DEFAULT_BUCKET, `audio/users/${admin.uid}/cards/sentences/c1.mp3`)?.data
    ).toEqual(mp3);
    expect(db.data(`users/${admin.uid}/customSentences/c1`)?.audioUrl).toBe(audioUrl);
  });

  test.each([
    ['no audio', { audioBase64: '', type: 'sentence', id: 's1' }, 'Audio data required.'],
    ['no type', { type: '', id: 's1' }, 'Type and ID required.'],
    ['no id', { type: 'sentence', id: '' }, 'Type and ID required.'],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(ask(data));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(storage.files.size).toBe(0);
  });

  test('an unknown audio type is an internal error and saves nothing', async () => {
    const error = await rejection(ask({ type: 'podcast', id: 's1' }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to save audio.' });
    expect(storage.files.size).toBe(0);
  });

  test('saving audio for a card that does not exist fails', async () => {
    const error = await rejection(ask({ type: 'vocabulary', id: 'missing' }));
    expect(error).toMatchObject({ code: 'internal', message: 'Failed to save audio.' });
  });
});

describe('createSystemAudio', () => {
  test('creates a processing item and queues it for synthesis', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_750_000_000_000);

    const { id } = await call(
      createSystemAudio,
      { title: 'Lekcja 1', text: 'Dzień dobry.' },
      admin
    );

    expect(db.data(`systemAudioItems/${id}`)).toEqual({
      id,
      title: 'Lekcja 1',
      text: 'Dzień dobry.',
      storagePath: '',
      duration: 0,
      status: 'processing',
      transcript: [],
      createdAt: 1_750_000_000_000,
    });
    expect(tasks.enqueued).toEqual([
      { queue: 'processSystemAudio', data: { id }, options: { dispatchDeadlineSeconds: 600 } },
    ]);
  });

  test('a task that cannot be queued removes the item and reports the failure', async () => {
    tasks.failure = new Error('queue unavailable');

    const error = await rejection(
      call(createSystemAudio, { title: 'Lekcja 1', text: 'Dzień dobry.' }, admin)
    );
    expect(error).toMatchObject({
      code: 'unavailable',
      message: 'Could not start generating audio. Please try again.',
    });
    expect(db.childPaths('systemAudioItems')).toEqual([]);

    tasks.failure = null;
    await call(createSystemAudio, { title: 'Lekcja 1', text: 'Dzień dobry.' }, admin);
    expect(tasks.enqueued).toHaveLength(1);
  });

  test('accepts text of exactly 50,000 characters', async () => {
    await call(createSystemAudio, { title: 'Long', text: 'a'.repeat(50_000) }, admin);
    expect(tasks.enqueued).toHaveLength(1);
  });

  test.each([
    ['no title', { title: '', text: 'x' }, 'Title is required.'],
    ['a non-string title', { title: 5, text: 'x' }, 'Title is required.'],
    ['no text', { title: 'T', text: '' }, 'Valid text required (max 50,000 chars).'],
    [
      'text over 50,000 characters',
      { title: 'T', text: 'a'.repeat(50_001) },
      'Valid text required (max 50,000 chars).',
    ],
  ])('rejects a request with %s', async (_case, data, message) => {
    const error = await rejection(call(createSystemAudio, data as never, admin));
    expect(error).toMatchObject({ code: 'invalid-argument', message });
    expect(db.writes).toEqual([]);
    expect(tasks.enqueued).toEqual([]);
  });
});

describe('deleteSystemAudio', () => {
  test('deletes the item and its audio file', async () => {
    db.seed('systemAudioItems/s1', { id: 's1', storagePath: 'audio/system/s1/audio.mp3' });
    storage.seed(DEFAULT_BUCKET, 'audio/system/s1/audio.mp3', { data: Buffer.from('mp3') });

    expect(await call(deleteSystemAudio, { id: 's1' }, admin)).toEqual({ success: true });
    expect(db.data('systemAudioItems/s1')).toBeUndefined();
    expect(storage.file(DEFAULT_BUCKET, 'audio/system/s1/audio.mp3')).toBeUndefined();
  });

  test('deletes an item whose audio was never generated or is already gone', async () => {
    db.seed('systemAudioItems/s1', { id: 's1', storagePath: '' });
    db.seed('systemAudioItems/s2', { id: 's2', storagePath: 'audio/system/s2/audio.mp3' });

    await call(deleteSystemAudio, { id: 's1' }, admin);
    await call(deleteSystemAudio, { id: 's2' }, admin);
    expect(db.childPaths('systemAudioItems')).toEqual([]);
  });

  test('rejects a request without an id', async () => {
    const error = await rejection(call(deleteSystemAudio, { id: '' }, admin));
    expect(error.code).toBe('invalid-argument');
  });
});
