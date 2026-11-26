/**
 * A learner's audio upload: processAudioUpload validates the pending file, reserves
 * the learner's audio slot and queues transcribeAudio, which checks the length,
 * transcribes the file and moves it into place.
 */
import { describe, expect, test, vi } from 'vitest';
import { processAudioUpload } from '../../src/triggers/storage/processAudioUpload.js';
import { transcribeAudio } from '../../src/tasks/transcribeAudio.js';
import { DEFAULT_BUCKET } from '../../src/shared/config.js';
import { createUser, db, installFakes, openai, storage, tasks } from '../support/sdk.js';
import { runObjectFinalized, runTask } from '../support/invoke.js';
import { installTestClock } from '../support/clock.js';
import { makeWav } from '../support/media.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('firebase-admin/auth', () => import('../support/sdk.js').then((m) => m.adminAuth));
vi.mock('firebase-admin/functions', () =>
  import('../support/sdk.js').then((m) => m.adminFunctions)
);
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();
installTestClock();

const learner = createUser('learner-1');
const admin = createUser('admin-1', { admin: true });

const MB = 1024 * 1024;
const pendingPath = (fileName: string, uid = learner.uid) =>
  `audio/users/${uid}/pending/a1/${fileName}`;
const itemPath = (uid = learner.uid) => `users/${uid}/audioItems/a1`;

describe('processAudioUpload', () => {
  function upload(
    fileName: string,
    { uid = learner.uid, contentType = 'audio/mpeg', size = 1000 } = {}
  ) {
    const name = pendingPath(fileName, uid);
    storage.seed(DEFAULT_BUCKET, name, { data: Buffer.from('audio'), contentType });
    return runObjectFinalized(processAudioUpload, {
      name,
      bucket: DEFAULT_BUCKET,
      size: String(size),
      contentType,
    });
  }

  function expectFailed(message: string, fileName: string, uid = learner.uid) {
    expect(db.data(itemPath(uid))).toEqual({
      id: 'a1',
      userId: uid,
      title: fileName.replace(/\.[^.]+$/, ''),
      fileName,
      duration: 0,
      fileSize: expect.any(Number),
      storagePath: '',
      status: 'error',
      error: message,
      transcript: [],
      createdAt: Date.now(),
    });
    expect(storage.file(DEFAULT_BUCKET, pendingPath(fileName, uid))).toBeUndefined();
    expect(tasks.enqueued).toEqual([]);
  }

  test('creates a processing audio item titled after the file and queues transcription', async () => {
    await upload('Lekcja 3.mp3', { size: 2 * MB });

    expect(db.data(itemPath())).toEqual({
      id: 'a1',
      userId: learner.uid,
      title: 'Lekcja 3',
      fileName: 'Lekcja 3.mp3',
      duration: 0,
      fileSize: 2 * MB,
      storagePath: '',
      status: 'processing',
      transcript: [],
      createdAt: Date.now(),
    });
    expect(tasks.enqueued).toEqual([
      {
        queue: 'transcribeAudio',
        data: {
          userId: learner.uid,
          audioId: 'a1',
          fileName: 'Lekcja 3.mp3',
          bucket: DEFAULT_BUCKET,
          filePath: pendingPath('Lekcja 3.mp3'),
        },
        options: { dispatchDeadlineSeconds: 600 },
      },
    ]);
    // The file stays in pending until the transcription task moves it.
    expect(storage.file(DEFAULT_BUCKET, pendingPath('Lekcja 3.mp3'))).toBeDefined();
  });

  test('ignores files outside the pending audio folder', async () => {
    const name = `audio/users/${learner.uid}/a1/audio.mp3`;
    storage.seed(DEFAULT_BUCKET, name, { data: Buffer.from('x') });
    await runObjectFinalized(processAudioUpload, { name, bucket: DEFAULT_BUCKET, size: 1 });

    expect(db.writes).toEqual([]);
    expect(tasks.enqueued).toEqual([]);
  });

  test('accepts audio recognised only by its extension', async () => {
    await upload('voice.m4a', { contentType: 'application/octet-stream' });
    expect(db.data(itemPath())?.status).toBe('processing');
  });

  test('rejects a file that is not audio', async () => {
    await upload('notes.pdf', { contentType: 'application/pdf' });
    expectFailed('Invalid file type. Supported: MP3, WAV, OGG, FLAC, M4A.', 'notes.pdf');
  });

  test('rejects a learner’s file over 25 MB', async () => {
    await upload('long.mp3', { size: 25 * MB + 1 });
    expectFailed('File too large. Maximum size is 25MB.', 'long.mp3');
  });

  test('accepts a learner’s file of exactly 25 MB', async () => {
    await upload('long.mp3', { size: 25 * MB });
    expect(db.data(itemPath())?.status).toBe('processing');
  });

  test('lets an admin upload a file over 25 MB', async () => {
    await upload('long.mp3', { uid: admin.uid, size: 200 * MB });
    expect(db.data(itemPath(admin.uid))?.status).toBe('processing');
  });

  test('rejects a second upload from a learner who already has an audio item', async () => {
    const existing = { id: 'old', userId: learner.uid, status: 'ready', title: 'Stare' };
    db.seed(`users/${learner.uid}/audioItems/old`, existing);

    await upload('new.mp3');
    expectFailed('Audio limit reached. Delete your existing audio to create a new one.', 'new.mp3');
    expect(db.data(`users/${learner.uid}/audioItems/old`)).toEqual(existing);
  });

  test('refuses learners while audio is disabled, but not admins', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });

    await upload('x.mp3');
    expectFailed('Audio processing is temporarily unavailable.', 'x.mp3');

    await upload('x.mp3', { uid: admin.uid });
    expect(db.data(itemPath(admin.uid))?.status).toBe('processing');
  });

  test('a failure to queue transcription marks the item failed and removes the upload', async () => {
    tasks.failure = new Error('queue unavailable');
    await upload('x.mp3');

    expect(db.data(itemPath())).toMatchObject({ status: 'error', error: 'queue unavailable' });
    expect(storage.file(DEFAULT_BUCKET, pendingPath('x.mp3'))).toBeUndefined();
  });
});

describe('transcribeAudio', () => {
  const segments = [{ text: 'Dzień dobry.', start: 0, end: 1.2 }];
  const words = [
    { word: 'Dzień', start: 0, end: 0.5 },
    { word: 'dobry', start: 0.5, end: 1.1 },
  ];

  /** Sets up the state processAudioUpload leaves behind: a pending WAV and a processing item. */
  function pending(seconds: number, uid = learner.uid, data = makeWav(seconds)) {
    storage.seed(DEFAULT_BUCKET, pendingPath('rec.wav', uid), { data, contentType: 'audio/wav' });
    db.seed(itemPath(uid), { id: 'a1', userId: uid, status: 'processing', duration: 0 });
    return {
      userId: uid,
      audioId: 'a1',
      fileName: 'rec.wav',
      bucket: DEFAULT_BUCKET,
      filePath: pendingPath('rec.wav', uid),
    };
  }

  test('transcribes the upload, moves it into place and marks the item ready', async () => {
    const task = pending(2);
    openai.transcription = { duration: 1.2, segments, words };

    await runTask(transcribeAudio, task);

    const finalPath = `audio/users/${learner.uid}/a1/rec.wav`;
    expect(db.data(itemPath())).toEqual({
      id: 'a1',
      userId: learner.uid,
      status: 'ready',
      duration: 1.2,
      storagePath: finalPath,
      transcript: [
        {
          text: 'Dzień dobry.',
          startTime: 0,
          endTime: 1.2,
          words: [
            { word: 'Dzień', startTime: 0, endTime: 0.5, confidence: 1 },
            { word: 'dobry', startTime: 0.5, endTime: 1.1, confidence: 1 },
          ],
        },
      ],
    });
    expect(storage.file(DEFAULT_BUCKET, finalPath)).toBeDefined();
    expect(storage.file(DEFAULT_BUCKET, task.filePath)).toBeUndefined();
    expect(openai.transcriptionRequests[0]).toMatchObject({ file: { name: 'rec.wav' } });
  });

  async function expectFailure(task: Record<string, unknown>, message: string, uid = learner.uid) {
    await expect(runTask(transcribeAudio, task)).rejects.toThrow(message);
    expect(db.data(itemPath(uid))).toMatchObject({ status: 'error', error: message });
    expect(storage.file(DEFAULT_BUCKET, task.filePath as string)).toBeUndefined();
  }

  test('rejects a learner’s recording whose header says it is over 10 minutes, before transcribing', async () => {
    await expectFailure(pending(601), 'Audio too long. Maximum duration is 10 minutes.');
    expect(openai.transcriptionRequests).toHaveLength(0);
  });

  test('accepts a learner’s recording of exactly 10 minutes', async () => {
    openai.transcription = { duration: 600, segments, words };
    await runTask(transcribeAudio, pending(600));
    expect(db.data(itemPath())?.status).toBe('ready');
  });

  test('rejects a learner’s recording whose length cannot be read', async () => {
    await expectFailure(
      pending(0, learner.uid, Buffer.from('definitely not audio')),
      'Could not determine audio duration. File may be corrupt.'
    );
    expect(openai.transcriptionRequests).toHaveLength(0);
  });

  test('rejects a learner’s recording that Whisper finds longer than 10 minutes', async () => {
    openai.transcription = { duration: 601, segments, words };
    await expectFailure(pending(5), 'Audio too long. Maximum duration is 10 minutes.');
  });

  test('admins can transcribe long recordings', async () => {
    openai.transcription = { duration: 1800, segments, words };
    await runTask(transcribeAudio, pending(1800, admin.uid));
    expect(db.data(itemPath(admin.uid))).toMatchObject({ status: 'ready', duration: 1800 });
  });

  test('refuses learners while audio is disabled', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });
    await expectFailure(pending(2), 'Audio processing is temporarily unavailable.');
  });

  test('admins are not affected by the kill switch', async () => {
    db.seed('config/killSwitch', { audioDisabled: true });
    openai.transcription = { duration: 2, segments, words };
    await runTask(transcribeAudio, pending(2, admin.uid));
    expect(db.data(itemPath(admin.uid))?.status).toBe('ready');
  });

  test('fails when the OpenAI key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expectFailure(pending(2), 'OpenAI API key not configured');
  });

  test('a Whisper failure marks the item failed and rethrows so the task is retried', async () => {
    openai.transcription = new Error('Whisper 503');
    await expectFailure(pending(2), 'Whisper 503');
  });

  // BUG: the catch block deletes the pending upload before rethrowing for a Cloud Tasks
  // retry (retryConfig maxAttempts: 2). The retry then cannot download the file, and
  // overwrites the item's error with a storage "No such object" message. Expected: a
  // transient Whisper failure followed by a successful retry leaves the item ready.
  // Actual: the learner's recording is gone and the item stays in error.
  test.fails(
    'a retry after a transient Whisper failure can still transcribe the upload',
    async () => {
      const task = pending(2);
      openai.transcription = new Error('Whisper 503');
      await runTask(transcribeAudio, task).catch(() => {});

      openai.transcription = { duration: 2, segments, words };
      await runTask(transcribeAudio, task);
      expect(db.data(itemPath())?.status).toBe('ready');
    }
  );

  // BUG: same cause as above. A recording rejected for being too long is rethrown, so
  // Cloud Tasks runs the task a second time; that run cannot find the deleted upload and
  // replaces the reason with a storage "No such object" message. Expected: the learner
  // still sees "Audio too long...". Actual: they see a meaningless storage error.
  test.fails('a retry of a rejected recording keeps the reason the learner was given', async () => {
    const task = pending(601);
    await runTask(transcribeAudio, task).catch(() => {});
    await runTask(transcribeAudio, task).catch(() => {});

    expect(db.data(itemPath())).toMatchObject({
      status: 'error',
      error: 'Audio too long. Maximum duration is 10 minutes.',
    });
  });
});
