import { describe, expect, test, vi } from 'vitest';
import {
  MAX_DURATION_SECONDS,
  isAcceptedAudio,
  parseAudioDurationSeconds,
  reserveUserAudioSlot,
  type AudioItemData,
} from '../../src/shared/userAudio.js';
import { db, installFakes } from '../support/sdk.js';
import { makeWav } from '../support/media.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));

installFakes();

describe('isAcceptedAudio', () => {
  test.each([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/ogg',
    'audio/flac',
    'audio/x-flac',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
  ])('accepts the %s content type whatever the file is called', (contentType) => {
    expect(isAcceptedAudio(contentType, 'recording')).toBe(true);
  });

  test.each(['lesson.mp3', 'lesson.WAV', 'a.b.ogg', 'x.flac', 'voice.M4A'])(
    'accepts %s by extension when the content type is generic or missing',
    (fileName) => {
      expect(isAcceptedAudio('application/octet-stream', fileName)).toBe(true);
      expect(isAcceptedAudio(undefined, fileName)).toBe(true);
    }
  );

  test.each([
    ['video/mp4', 'clip.mp4'],
    ['application/pdf', 'book.pdf'],
    [undefined, 'notes.txt'],
    [undefined, 'mp3'],
    ['text/plain', 'mp3.exe'],
  ])('rejects %s named %s', (contentType, fileName) => {
    expect(isAcceptedAudio(contentType, fileName)).toBe(false);
  });
});

describe('parseAudioDurationSeconds', () => {
  test('reads the duration from a WAV header', async () => {
    expect(await parseAudioDurationSeconds(makeWav(2.5), 'audio/wav')).toBeCloseTo(2.5, 2);
  });

  test('reads the duration without a content type', async () => {
    expect(await parseAudioDurationSeconds(makeWav(1))).toBeCloseTo(1, 2);
  });

  test('can tell a recording is over the 10 minute limit', async () => {
    const duration = await parseAudioDurationSeconds(
      makeWav(MAX_DURATION_SECONDS + 1),
      'audio/wav'
    );
    expect(duration).toBeGreaterThan(MAX_DURATION_SECONDS);
  });

  test('returns null for data that is not audio', async () => {
    expect(
      await parseAudioDurationSeconds(Buffer.from('not audio at all'), 'audio/mpeg')
    ).toBeNull();
  });
});

describe('reserveUserAudioSlot', () => {
  const item = (id: string): AudioItemData => ({
    id,
    userId: 'u1',
    title: id,
    fileName: `${id}.mp3`,
    duration: 0,
    fileSize: 10,
    storagePath: '',
    status: 'processing',
    transcript: [],
    createdAt: 1,
  });
  const ref = (id: string) => db.collection('users').doc('u1').collection('audioItems').doc(id);

  test('a learner with no audio gets their item saved', async () => {
    await reserveUserAudioSlot('u1', ref('a1') as never, item('a1'), false);
    expect(db.data('users/u1/audioItems/a1')).toEqual(item('a1'));
  });

  test('a learner who already has an audio item is refused and nothing is saved', async () => {
    db.seed('users/u1/audioItems/old', { ...item('old'), status: 'error' });

    await expect(reserveUserAudioSlot('u1', ref('a2') as never, item('a2'), false)).rejects.toThrow(
      'Audio limit reached. Delete your existing audio to create a new one.'
    );
    expect(db.data('users/u1/audioItems/a2')).toBeUndefined();
  });

  test('another user’s audio does not count against the learner', async () => {
    db.seed('users/u2/audioItems/theirs', item('theirs'));
    await reserveUserAudioSlot('u1', ref('a1') as never, item('a1'), false);
    expect(db.data('users/u1/audioItems/a1')).toBeDefined();
  });

  test('admins can keep any number of audio items', async () => {
    db.seed('users/u1/audioItems/one', item('one'));
    db.seed('users/u1/audioItems/two', item('two'));

    await reserveUserAudioSlot('u1', ref('three') as never, item('three'), true);
    expect(db.childPaths('users/u1/audioItems')).toHaveLength(3);
  });
});
