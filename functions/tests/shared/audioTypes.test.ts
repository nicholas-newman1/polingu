import { describe, expect, test, vi } from 'vitest';
import {
  synthesizeAndUploadAudio,
  updateFirestoreAudioUrl,
  uploadAudioBuffer,
  type AudioType,
} from '../../src/shared/audioTypes.js';
import { synthesizeAndTranscribe } from '../../src/shared/textAudio.js';
import { AUDIO_BUCKET, DEFAULT_BUCKET } from '../../src/shared/config.js';
import { OPENAI_KEY, db, installFakes, openai, storage, tts } from '../support/sdk.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

const audio = Buffer.from('mp3');

describe('uploadAudioBuffer', () => {
  test.each([
    ['sentence', 's1', undefined, 'sentences/s1.mp3'],
    ['declension', '12', undefined, 'declension/12.mp3'],
    ['vocabulary', 'v1', undefined, 'vocabulary/v1.mp3'],
    ['verb-infinitive', 'isc', undefined, 'verb-infinitives/isc.mp3'],
    ['conjugation', 'isc', 'isc_present_1sg', 'conjugation/isc_present_1sg.mp3'],
    ['conjugation', 'isc', undefined, 'conjugation/isc.mp3'],
  ] as const)(
    'stores built-in %s audio publicly in the audio bucket',
    async (type, id, subPath, path) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_700_000_000_000);

      const url = await uploadAudioBuffer(audio, type, id, subPath);

      expect(storage.file(AUDIO_BUCKET, path)).toEqual({
        data: audio,
        contentType: 'audio/mpeg',
        metadata: { cacheControl: 'public, max-age=31536000' },
      });
      // The version query busts the year-long cache when audio is regenerated.
      expect(url).toBe(`https://storage.googleapis.com/${AUDIO_BUCKET}/${path}?v=1700000000000`);
    }
  );

  test.each([
    ['custom-sentence', 'audio/users/u1/cards/sentences/c1.mp3'],
    ['custom-vocabulary', 'audio/users/u1/cards/vocabulary/c1.mp3'],
    ['custom-declension', 'audio/users/u1/cards/declension/c1.mp3'],
  ] as const)(
    'stores %s audio under the owner in the default bucket with a download token',
    async (type, path) => {
      const url = await uploadAudioBuffer(audio, type, 'c1', undefined, 'u1');

      const stored = storage.file(DEFAULT_BUCKET, path);
      const token = (stored?.metadata?.metadata as { firebaseStorageDownloadTokens: string })
        .firebaseStorageDownloadTokens;
      expect(token).toMatch(/^[0-9a-f-]{36}$/);
      expect(url).toBe(
        `https://firebasestorage.googleapis.com/v0/b/${DEFAULT_BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
      );
    }
  );

  test('gives every upload of a custom card a fresh download token', async () => {
    const first = await uploadAudioBuffer(audio, 'custom-sentence', 'c1', undefined, 'u1');
    const second = await uploadAudioBuffer(audio, 'custom-sentence', 'c1', undefined, 'u1');
    expect(first).not.toBe(second);
  });

  test('rejects an unknown audio type', async () => {
    await expect(uploadAudioBuffer(audio, 'podcast' as AudioType, 'x')).rejects.toThrow(
      'Unknown audio type: podcast'
    );
  });
});

describe('updateFirestoreAudioUrl', () => {
  test.each([
    ['sentence', 'sentences/s1', 's1'],
    ['declension', 'declensionCards/7', '7'],
    ['vocabulary', 'vocabulary/v1', 'v1'],
  ] as const)('sets audioUrl on the %s document', async (type, path, id) => {
    db.seed(path, { polish: 'x' });
    await updateFirestoreAudioUrl(type, id, 'https://a/new.mp3');
    expect(db.data(path)).toEqual({ polish: 'x', audioUrl: 'https://a/new.mp3' });
  });

  test('sets the infinitive audio on a verb', async () => {
    db.seed('verbs/isc', { infinitive: 'iść' });
    await updateFirestoreAudioUrl('verb-infinitive', 'isc', 'https://a/inf.mp3');
    expect(db.data('verbs/isc')).toEqual({
      infinitive: 'iść',
      infinitiveAudioUrl: 'https://a/inf.mp3',
    });
  });

  test('sets the audio of one conjugated form, including form keys with underscores', async () => {
    db.seed('verbs/isc', {
      conjugations: {
        past: { '1sg_m': { pl: 'szedłem' }, '1sg_f': { pl: 'szłam', audioUrl: 'old' } },
      },
    });

    await updateFirestoreAudioUrl('conjugation', 'isc', 'https://a/f.mp3', 'isc_past_1sg_f');
    expect(db.data('verbs/isc')?.conjugations).toEqual({
      past: { '1sg_m': { pl: 'szedłem' }, '1sg_f': { pl: 'szłam', audioUrl: 'https://a/f.mp3' } },
    });
  });

  test('writes nothing for a conjugation without a form path', async () => {
    db.seed('verbs/isc', { conjugations: {} });
    await updateFirestoreAudioUrl('conjugation', 'isc', 'https://a/f.mp3');
    expect(db.writes).toEqual([]);
  });

  test.each([
    ['custom-sentence', 'customSentences'],
    ['custom-vocabulary', 'customVocabulary'],
    ['custom-declension', 'customDeclension'],
  ] as const)('sets audioUrl on the owner’s %s card', async (type, collection) => {
    db.seed(`users/u1/${collection}/c1`, { polish: 'x' });
    await updateFirestoreAudioUrl(type, 'c1', 'https://a/c.mp3', undefined, 'u1');
    expect(db.data(`users/u1/${collection}/c1`)?.audioUrl).toBe('https://a/c.mp3');
  });

  test('writes nothing for a custom card without an owner', async () => {
    await updateFirestoreAudioUrl('custom-sentence', 'c1', 'https://a/c.mp3');
    expect(db.writes).toEqual([]);
  });

  test('fails when the card does not exist', async () => {
    await expect(updateFirestoreAudioUrl('sentence', 'missing', 'u')).rejects.toThrow(/NOT_FOUND/);
  });
});

describe('synthesizeAndUploadAudio', () => {
  test('synthesizes the text and uploads the result', async () => {
    const url = await synthesizeAndUploadAudio('Dzień dobry', 'vocabulary', 'v1');

    expect(tts.requests.map((r) => r.input.text)).toEqual(['Dzień dobry']);
    expect(storage.file(AUDIO_BUCKET, 'vocabulary/v1.mp3')?.data).toEqual(
      Buffer.from('mp3(Dzień dobry)')
    );
    expect(url).toMatch(/^https:\/\/storage\.googleapis\.com\/polingu-audio\/vocabulary\/v1\.mp3/);
  });

  test('returns null and uploads nothing when TTS returns no audio', async () => {
    tts.respond = () => null;
    expect(await synthesizeAndUploadAudio('x', 'vocabulary', 'v1')).toBeNull();
    expect(storage.files.size).toBe(0);
  });
});

describe('synthesizeAndTranscribe', () => {
  test('saves the synthesized audio and returns it with its transcript', async () => {
    openai.transcription = {
      duration: 1.5,
      segments: [{ text: 'Cześć.', start: 0, end: 1.5 }],
      words: [{ word: 'Cześć', start: 0.1, end: 0.9 }],
    };

    const result = await synthesizeAndTranscribe('Cześć.', 'audio/system/a1/audio.mp3', 'sys.mp3');

    expect(storage.file(DEFAULT_BUCKET, 'audio/system/a1/audio.mp3')).toMatchObject({
      data: Buffer.from('mp3(Cześć.)'),
      contentType: 'audio/mpeg',
    });
    expect(openai.apiKeys).toEqual([OPENAI_KEY]);
    expect(openai.transcriptionRequests[0]).toMatchObject({
      file: { name: 'sys.mp3', buffer: Buffer.from('mp3(Cześć.)') },
    });
    expect(result).toMatchObject({ duration: 1.5, audioBuffer: Buffer.from('mp3(Cześć.)') });
    expect(result.segments[0].words.map((w) => w.word)).toEqual(['Cześć']);
  });

  test('fails without transcribing when the OpenAI key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(synthesizeAndTranscribe('Cześć.', 'p.mp3', 'a.mp3')).rejects.toThrow(
      'OpenAI API key not configured.'
    );
    expect(openai.transcriptionRequests).toHaveLength(0);
  });
});
