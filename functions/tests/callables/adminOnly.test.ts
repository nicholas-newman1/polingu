/**
 * Every admin-only callable must turn away signed-out callers and learners before
 * it spends money (OpenAI, DeepL, TTS) or touches shared content.
 */
import { describe, expect, test, vi } from 'vitest';
import { HttpsError } from 'firebase-functions/https';
import { generateExample } from '../../src/callables/generateExample.js';
import { generateSentences } from '../../src/callables/generateSentences.js';
import { discoverCurriculum } from '../../src/callables/discoverCurriculum.js';
import { processSentence } from '../../src/callables/processSentence.js';
import { generateAudioPreview } from '../../src/callables/generateAudioPreview.js';
import { saveAudio } from '../../src/callables/saveAudio.js';
import { createSystemAudio } from '../../src/callables/createSystemAudio.js';
import { deleteSystemAudio } from '../../src/callables/deleteSystemAudio.js';
import { AUDIO_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, openai, storage, tasks, tts } from '../support/sdk.js';
import { call } from '../support/invoke.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));
vi.mock('firebase-admin/functions', () =>
  import('../support/sdk.js').then((m) => m.adminFunctions)
);
vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

// A learner who is an admin in Firebase Auth but whose ID token has no admin claim
// (e.g. a token minted before the claim was granted) is still turned away.
const learner = createUser('learner-1');
const staleToken = { uid: createUser('promoted-1', { admin: true }).uid };

const valid = {
  generateExample: { polish: 'kot', english: 'cat' },
  generateSentences: { level: 'A1', tags: [], count: 1 },
  discoverCurriculum: { mode: 'grammar', existingTags: { topics: [], grammar: [], style: [] } },
  processSentence: { text: 'Mam kota.', sourceLang: 'PL' },
  generateAudioPreview: { text: 'Cześć', type: 'sentence' },
  saveAudio: { audioBase64: Buffer.from('mp3').toString('base64'), type: 'sentence', id: 's1' },
  createSystemAudio: { title: 'Lekcja', text: 'Dzień dobry.' },
  deleteSystemAudio: { id: 's1' },
};

const callables = [
  ['generateExample', generateExample],
  ['generateSentences', generateSentences],
  ['discoverCurriculum', discoverCurriculum],
  ['processSentence', processSentence],
  ['generateAudioPreview', generateAudioPreview],
  ['saveAudio', saveAudio],
  ['createSystemAudio', createSystemAudio],
  ['deleteSystemAudio', deleteSystemAudio],
] as const;

const callers = [
  ['a signed-out caller', undefined],
  ['a learner', learner],
  ['an admin whose token lacks the claim', staleToken],
] as const;

describe.each(callables)('%s', (name, fn) => {
  test.each(callers)(
    'rejects %s with permission-denied and no side effects',
    async (_who, user) => {
      db.seed('sentences/s1', { polish: 'Cześć' });
      db.seed('systemAudioItems/s1', { id: 's1', storagePath: 'audio/system/s1/audio.mp3' });
      db.writes.length = 0;
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const error = await (call(fn as never, valid[name], user) as Promise<unknown>).catch(
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(HttpsError);
      expect(error).toMatchObject({ code: 'permission-denied', message: 'Admin access required.' });
      expect(openai.chatRequests).toHaveLength(0);
      expect(tts.requests).toHaveLength(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(db.writes).toEqual([]);
      expect(storage.file(AUDIO_BUCKET, 'sentences/s1.mp3')).toBeUndefined();
      expect(tasks.enqueued).toEqual([]);
    }
  );
});

describe('admins', () => {
  const admin = createUser('admin-1', { admin: true });

  test.each(callables)('%s accepts an admin with the same request', async (name, fn) => {
    db.seed('sentences/s1', { polish: 'Cześć' });
    db.seed('systemAudioItems/s1', { id: 's1', storagePath: '' });
    openai.replyAlways(() =>
      JSON.stringify({ examples: [{ polish: 'a', english: 'b' }], sentences: [], suggestions: [] })
    );
    vi.stubGlobal(
      'fetch',
      async () => new Response(JSON.stringify({ translations: [{ text: 'I have a cat.' }] }))
    );

    await expect(call(fn as never, valid[name], admin) as Promise<unknown>).resolves.toBeDefined();
  });
});
