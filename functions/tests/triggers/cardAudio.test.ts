/**
 * Card writes generate pronunciation audio: built-in cards (vocabulary, sentences,
 * declension) always, custom cards only for admins. These run the deployed triggers.
 */
import { describe, expect, test, vi } from 'vitest';
import { onVocabularyWrite } from '../../src/triggers/firestore/onVocabularyWrite.js';
import { onSentenceWrite } from '../../src/triggers/firestore/onSentenceWrite.js';
import { onDeclensionCardWrite } from '../../src/triggers/firestore/onDeclensionCardWrite.js';
import { onCustomSentenceWrite } from '../../src/triggers/firestore/onCustomSentenceWrite.js';
import { onCustomVocabularyWrite } from '../../src/triggers/firestore/onCustomVocabularyWrite.js';
import { onCustomDeclensionWrite } from '../../src/triggers/firestore/onCustomDeclensionWrite.js';
import { AUDIO_BUCKET, DEFAULT_BUCKET } from '../../src/shared/config.js';
import { FieldValue } from '../support/fakeFirestore.js';
import { auth, createUser, db, installFakes, storage, tts } from '../support/sdk.js';
import { runDocumentWrite } from '../support/invoke.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));
vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));

installFakes();

type Doc = Record<string, unknown> | undefined;

const spoken = () => tts.requests.map((r) => r.input.text);

const systemCards = [
  {
    name: 'vocabulary',
    trigger: onVocabularyWrite,
    collection: 'vocabulary',
    textField: 'polish',
    audioPath: 'vocabulary/c1.mp3',
  },
  {
    name: 'sentence',
    trigger: onSentenceWrite,
    collection: 'sentences',
    textField: 'polish',
    audioPath: 'sentences/c1.mp3',
  },
  {
    name: 'declension',
    trigger: onDeclensionCardWrite,
    collection: 'declensionCards',
    textField: 'back',
    audioPath: 'declension/c1.mp3',
  },
] as const;

describe.each(systemCards)(
  'built-in $name cards',
  ({ trigger, collection, textField, audioPath }) => {
    const path = `${collection}/c1`;
    const card = (text: string, extra: Record<string, unknown> = {}) => ({
      [textField]: text,
      english: 'meaning',
      ...extra,
    });
    const write = (before: Doc, after: Doc) =>
      runDocumentWrite(trigger, `${collection}/{docId}`, path, before, after);

    test(`a new card gets audio of its ${textField} text and is marked ready`, async () => {
      await write(undefined, card('  Dzień dobry  '));

      expect(spoken()).toEqual(['Dzień dobry']);
      expect(storage.file(AUDIO_BUCKET, audioPath)?.data).toEqual(Buffer.from('mp3(Dzień dobry)'));
      const stored = db.data(path)!;
      expect(stored.audioStatus).toBe('ready');
      expect(stored.audioUrl).toMatch(
        new RegExp(`^https://storage\\.googleapis\\.com/${AUDIO_BUCKET}/${audioPath}\\?v=\\d+$`)
      );
      expect(stored).not.toHaveProperty('audioError');
    });

    test('the card is marked generating before the audio is made', async () => {
      await write(undefined, card('Dzień dobry'));

      expect(db.writes.map((w) => w.data?.audioStatus)).toEqual(['generating', 'ready']);
      expect(db.writes[0].data).toEqual({
        audioStatus: 'generating',
        audioError: FieldValue.delete(),
      });
    });

    test('a new card that already has audio is left alone', async () => {
      await write(undefined, card('Dzień dobry', { audioUrl: 'https://a/existing.mp3' }));
      expect(tts.requests).toHaveLength(0);
      expect(db.writes).toEqual([]);
    });

    test('editing the text regenerates the audio even if the card had some', async () => {
      await write(
        card('Dzień dobry', { audioUrl: 'https://a/old.mp3' }),
        card('Dobry wieczór', { audioUrl: 'https://a/old.mp3' })
      );
      expect(spoken()).toEqual(['Dobry wieczór']);
      expect(db.data(path)?.audioUrl).not.toBe('https://a/old.mp3');
    });

    test('an edit that leaves the spoken text unchanged does not regenerate audio', async () => {
      await write(card('Dzień dobry'), card(' Dzień dobry ', { english: 'Good day', tags: ['x'] }));
      expect(tts.requests).toHaveLength(0);
      expect(db.writes).toEqual([]);
    });

    test('the trigger’s own status updates do not start another generation', async () => {
      await write(card('Dzień dobry'), card('Dzień dobry', { audioStatus: 'generating' }));
      expect(tts.requests).toHaveLength(0);
    });

    test('a card without text gets no audio', async () => {
      await write(undefined, card('   '));
      await write(undefined, { english: 'only English' });
      expect(tts.requests).toHaveLength(0);
    });

    test('deleting a card does nothing', async () => {
      await write(card('Dzień dobry'), undefined);
      expect(tts.requests).toHaveLength(0);
      expect(db.writes).toEqual([]);
    });

    test('a TTS failure is recorded on the card instead of failing the trigger', async () => {
      tts.respond = () => new Error('quota exceeded');
      await write(undefined, card('Dzień dobry'));

      expect(db.data(path)).toMatchObject({ audioStatus: 'error', audioError: 'quota exceeded' });
      expect(db.data(path)).not.toHaveProperty('audioUrl');
    });

    test('empty TTS audio is recorded as an error', async () => {
      tts.respond = () => null;
      await write(undefined, card('Dzień dobry'));
      expect(db.data(path)).toMatchObject({
        audioStatus: 'error',
        audioError: 'TTS returned no audio content.',
      });
    });

    test('a successful retry clears the previous error', async () => {
      await write(
        card('Dzień dobry', { audioStatus: 'error', audioError: 'quota exceeded' }),
        card('Dzień dobry!', { audioStatus: 'error', audioError: 'quota exceeded' })
      );
      expect(db.data(path)).toMatchObject({ audioStatus: 'ready' });
      expect(db.data(path)).not.toHaveProperty('audioError');
    });

    test('audio is still generated when marking the card generating fails', async () => {
      db.failWrites({ op: 'update' }, new Error('contention'), true);
      await write(undefined, card('Dzień dobry'));
      expect(db.data(path)).toMatchObject({ audioStatus: 'ready' });
    });

    test('new audio clears an earlier error even when marking the card generating failed', async () => {
      const failed = { audioStatus: 'error', audioError: 'quota exceeded' };
      db.failWrites({ op: 'update' }, new Error('contention'), true);

      await write(card('Dzień dobry', failed), card('Dobry wieczór', failed));
      expect(db.data(path)).toMatchObject({ audioStatus: 'ready' });
      expect(db.data(path)).not.toHaveProperty('audioError');
    });

    test('a failure to save the finished audio is recorded as an error', async () => {
      storage.failSaves(/.*/);
      await write(undefined, card('Dzień dobry'));
      expect(db.data(path)).toMatchObject({ audioStatus: 'error' });
    });
  }
);

const customCards = [
  {
    name: 'sentence',
    trigger: onCustomSentenceWrite,
    collection: 'customSentences',
    textField: 'polish',
    folder: 'sentences',
  },
  {
    name: 'vocabulary',
    trigger: onCustomVocabularyWrite,
    collection: 'customVocabulary',
    textField: 'polish',
    folder: 'vocabulary',
  },
  {
    name: 'declension',
    trigger: onCustomDeclensionWrite,
    collection: 'customDeclension',
    textField: 'back',
    folder: 'declension',
  },
] as const;

describe.each(customCards)('custom $name cards', ({ trigger, collection, textField, folder }) => {
  const admin = createUser('admin-1', { admin: true });
  const learner = createUser('learner-1');

  const pathFor = (uid: string) => `users/${uid}/${collection}/c1`;
  const card = (text: string, extra: Record<string, unknown> = {}) => ({
    id: 'c1',
    [textField]: text,
    ...extra,
  });
  const write = (uid: string, before: Doc, after: Doc) =>
    runDocumentWrite(trigger, `users/{userId}/${collection}/{cardId}`, pathFor(uid), before, after);

  test('an admin’s new card gets private audio with a download link', async () => {
    await write(admin.uid, undefined, card(' Cześć '));

    expect(spoken()).toEqual(['Cześć']);
    const storagePath = `audio/users/${admin.uid}/cards/${folder}/c1.mp3`;
    expect(storage.file(DEFAULT_BUCKET, storagePath)?.data).toEqual(Buffer.from('mp3(Cześć)'));
    expect(db.data(pathFor(admin.uid))?.audioUrl).toMatch(
      new RegExp(`^https://firebasestorage\\.googleapis\\.com/v0/b/${DEFAULT_BUCKET}/o/`)
    );
  });

  test('a learner’s card gets no generated audio', async () => {
    await write(learner.uid, undefined, card('Cześć'));
    expect(tts.requests).toHaveLength(0);
    expect(db.data(pathFor(learner.uid))).toEqual(card('Cześć'));
  });

  test('a card of an unknown user gets no audio and does not fail', async () => {
    await expect(write('ghost', undefined, card('Cześć'))).resolves.toBeUndefined();
    expect(tts.requests).toHaveLength(0);
  });

  test('a failed admin lookup skips audio rather than failing', async () => {
    auth.failure = new Error('auth unavailable');
    await expect(write(admin.uid, undefined, card('Cześć'))).resolves.toBeUndefined();
    expect(tts.requests).toHaveLength(0);
  });

  test('a new card that already has audio is left alone', async () => {
    await write(admin.uid, undefined, card('Cześć', { audioUrl: 'https://a/mine.mp3' }));
    expect(tts.requests).toHaveLength(0);
  });

  test('editing the text regenerates the audio', async () => {
    await write(admin.uid, card('Cześć', { audioUrl: 'old' }), card('Hej', { audioUrl: 'old' }));
    expect(spoken()).toEqual(['Hej']);
    expect(db.data(pathFor(admin.uid))?.audioUrl).not.toBe('old');
  });

  test('an edit that leaves the spoken text unchanged does nothing', async () => {
    await write(admin.uid, card('Cześć'), card('Cześć ', { english: 'Hi' }));
    expect(tts.requests).toHaveLength(0);
    expect(db.writes).toEqual([]);
  });

  test('a card without text gets no audio', async () => {
    await write(admin.uid, undefined, card('  '));
    expect(tts.requests).toHaveLength(0);
  });

  test('deleting a card does nothing', async () => {
    await write(admin.uid, card('Cześć'), undefined);
    expect(tts.requests).toHaveLength(0);
    expect(db.writes).toEqual([]);
  });

  test('a TTS failure leaves the card unchanged and does not fail the trigger', async () => {
    tts.respond = () => new Error('quota exceeded');
    await expect(write(admin.uid, undefined, card('Cześć'))).resolves.toBeUndefined();
    expect(db.data(pathFor(admin.uid))).toEqual(card('Cześć'));
  });

  test('empty TTS audio leaves the card unchanged', async () => {
    tts.respond = () => null;
    await write(admin.uid, undefined, card('Cześć'));
    expect(db.data(pathFor(admin.uid))).toEqual(card('Cześć'));
  });
});
