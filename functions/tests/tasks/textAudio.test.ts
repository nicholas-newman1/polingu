/**
 * Text-to-audio tasks: processUserTextAudio (a learner's pasted text) and
 * processSystemAudio (admin-authored listening content). Both synthesize the text,
 * save the MP3, transcribe it for word timings and mark the item ready.
 */
import { describe, expect, test, vi } from 'vitest';
import { processUserTextAudio } from '../../src/tasks/processUserTextAudio.js';
import { processSystemAudio } from '../../src/tasks/processSystemAudio.js';
import { DEFAULT_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, openai, storage, tts } from '../support/sdk.js';
import { runTask } from '../support/invoke.js';
import { installTestClock } from '../support/clock.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));
vi.mock('@google-cloud/text-to-speech', () => import('../support/sdk.js').then((m) => m.ttsModule));
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();
installTestClock();

const learner = createUser('learner-1');
const admin = createUser('admin-1', { admin: true });

const transcription = {
  duration: 3.5,
  segments: [{ text: ' Ala ma kota. ', start: 0, end: 3.5 }],
  words: [
    { word: 'Ala', start: 0, end: 0.8 },
    { word: 'ma', start: 0.8, end: 1.2 },
    { word: 'kota', start: 1.2, end: 2 },
  ],
};

describe('processUserTextAudio', () => {
  const itemPath = (uid = learner.uid) => `users/${uid}/audioItems/a1`;
  const audioPath = (uid = learner.uid) => `audio/users/${uid}/a1/audio.mp3`;

  function queued(uid = learner.uid, text = 'Ala ma kota.') {
    db.seed(itemPath(uid), { id: 'a1', userId: uid, title: 'Ala', status: 'processing' });
    return { userId: uid, audioId: 'a1', text };
  }

  test('synthesizes the text, saves it and marks the item ready with its transcript', async () => {
    openai.transcription = transcription;
    await runTask(processUserTextAudio, queued());

    const audio = Buffer.from('mp3(Ala ma kota.)');
    expect(storage.file(DEFAULT_BUCKET, audioPath())).toMatchObject({
      data: audio,
      contentType: 'audio/mpeg',
    });
    expect(db.data(itemPath())).toEqual({
      id: 'a1',
      userId: learner.uid,
      title: 'Ala',
      status: 'ready',
      fileSize: audio.length,
      duration: 3.5,
      storagePath: audioPath(),
      transcript: [
        {
          text: 'Ala ma kota.',
          startTime: 0,
          endTime: 3.5,
          words: [
            { word: 'Ala', startTime: 0, endTime: 0.8, confidence: 1 },
            { word: 'ma', startTime: 0.8, endTime: 1.2, confidence: 1 },
            { word: 'kota', startTime: 1.2, endTime: 2, confidence: 1 },
          ],
        },
      ],
    });
  });

  test('refuses learners while audio is disabled, without spending on TTS', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });

    await expect(runTask(processUserTextAudio, queued())).rejects.toThrow(
      'Audio processing is temporarily unavailable.'
    );
    expect(tts.requests).toHaveLength(0);
    expect(db.data(itemPath())).toMatchObject({
      status: 'error',
      error: 'Audio processing is temporarily unavailable.',
    });
  });

  test('admins are not affected by the kill switch', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });
    openai.transcription = transcription;

    await runTask(processUserTextAudio, queued(admin.uid));
    expect(db.data(itemPath(admin.uid))?.status).toBe('ready');
  });

  test('a transcription failure marks the item failed, removes the audio and rethrows', async () => {
    openai.transcription = new Error('Whisper 500');

    await expect(runTask(processUserTextAudio, queued())).rejects.toThrow('Whisper 500');
    expect(db.data(itemPath())).toMatchObject({ status: 'error', error: 'Whisper 500' });
    expect(storage.file(DEFAULT_BUCKET, audioPath())).toBeUndefined();
  });

  test('a TTS failure marks the item failed', async () => {
    tts.respond = () => null;

    await expect(runTask(processUserTextAudio, queued())).rejects.toThrow('TTS produced no audio.');
    expect(db.data(itemPath())).toMatchObject({ status: 'error', error: 'TTS produced no audio.' });
  });

  test('a retry after a transient failure succeeds, since the text travels with the task', async () => {
    const task = queued();
    openai.transcription = new Error('Whisper 500');
    await runTask(processUserTextAudio, task).catch(() => {});

    openai.transcription = transcription;
    await runTask(processUserTextAudio, task);
    expect(db.data(itemPath())?.status).toBe('ready');
    expect(storage.file(DEFAULT_BUCKET, audioPath())).toBeDefined();
  });
});

describe('processSystemAudio', () => {
  const itemPath = 'systemAudioItems/s1';
  const audioPath = 'audio/system/s1/audio.mp3';

  function queued(text = 'Ala ma kota.') {
    db.seed(itemPath, { id: 's1', title: 'Ala', text, status: 'processing', storagePath: '' });
    return { id: 's1' };
  }

  test('synthesizes the stored text and marks the item ready with its transcript', async () => {
    openai.transcription = transcription;
    await runTask(processSystemAudio, queued());

    expect(tts.requests.map((r) => r.input.text)).toEqual(['Ala ma kota.']);
    expect(storage.file(DEFAULT_BUCKET, audioPath)?.data).toEqual(Buffer.from('mp3(Ala ma kota.)'));
    expect(db.data(itemPath)).toMatchObject({
      status: 'ready',
      storagePath: audioPath,
      duration: 3.5,
      transcript: [expect.objectContaining({ text: 'Ala ma kota.' })],
    });
  });

  test('is not affected by the kill switch', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });
    openai.transcription = transcription;
    await runTask(processSystemAudio, queued());
    expect(db.data(itemPath)?.status).toBe('ready');
  });

  test('a failure marks the item failed, removes the audio and rethrows', async () => {
    openai.transcription = new Error('Whisper 500');

    await expect(runTask(processSystemAudio, queued())).rejects.toThrow('Whisper 500');
    expect(db.data(itemPath)).toMatchObject({ status: 'error', error: 'Whisper 500' });
    expect(storage.file(DEFAULT_BUCKET, audioPath)).toBeUndefined();
  });

  test('fails when the item was deleted before processing', async () => {
    await expect(runTask(processSystemAudio, { id: 'gone' })).rejects.toThrow();
    expect(tts.requests).toHaveLength(0);
  });
});
