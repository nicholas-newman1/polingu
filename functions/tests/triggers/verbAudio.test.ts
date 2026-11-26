/**
 * Verb writes queue audio jobs for the infinitive and every conjugated form
 * (onVerbWrite); the generateVerbAudio task then makes the audio and records
 * the URLs and an overall status on the verb.
 */
import { describe, expect, test, vi } from 'vitest';
import { onVerbWrite } from '../../src/triggers/firestore/onVerbWrite.js';
import { generateVerbAudio } from '../../src/tasks/generateVerbAudio.js';
import { AUDIO_BUCKET } from '../../src/shared/config.js';
import { db, installFakes, storage, tasks, tts } from '../support/sdk.js';
import { runDocumentWrite, runTask } from '../support/invoke.js';

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

type Doc = Record<string, unknown> | undefined;
type Job = { fieldPath: string; text: string; audioType: string; subPath?: string };

const verb = (overrides: Record<string, unknown> = {}) => ({
  id: 'isc',
  infinitive: 'iść',
  conjugations: {
    present: { '1sg': { pl: 'idę' }, '2sg': { pl: 'idziesz' } },
    past: { '1sg_f': { pl: 'szłam' } },
  },
  ...overrides,
});

const writeVerb = (before: Doc, after: Doc) =>
  runDocumentWrite(onVerbWrite, 'verbs/{docId}', 'verbs/isc', before, after);

const queuedJobs = () => {
  expect(tasks.enqueued).toHaveLength(1);
  return tasks.enqueued[0].data.jobs as Job[];
};

describe('onVerbWrite', () => {
  test('a new verb queues audio for the infinitive and every form', async () => {
    await writeVerb(undefined, verb());

    expect(tasks.enqueued).toEqual([
      {
        queue: 'generateVerbAudio',
        data: {
          docId: 'isc',
          jobs: [
            { fieldPath: 'infinitiveAudioUrl', text: 'iść', audioType: 'verb-infinitive' },
            {
              fieldPath: 'conjugations.present.1sg.audioUrl',
              text: 'idę',
              audioType: 'conjugation',
              subPath: 'isc_present_1sg',
            },
            {
              fieldPath: 'conjugations.present.2sg.audioUrl',
              text: 'idziesz',
              audioType: 'conjugation',
              subPath: 'isc_present_2sg',
            },
            {
              fieldPath: 'conjugations.past.1sg_f.audioUrl',
              text: 'szłam',
              audioType: 'conjugation',
              subPath: 'isc_past_1sg_f',
            },
          ],
        },
        options: { dispatchDeadlineSeconds: 600 },
      },
    ]);
  });

  test('the verb is marked generating when jobs are queued', async () => {
    await writeVerb(undefined, verb({ audioError: 'old failure' }));
    expect(db.data('verbs/isc')).toMatchObject({ audioStatus: 'generating' });
    expect(db.data('verbs/isc')).not.toHaveProperty('audioError');
  });

  test('a new verb only queues audio that is missing', async () => {
    await writeVerb(
      undefined,
      verb({
        infinitiveAudioUrl: 'https://a/inf.mp3',
        conjugations: {
          present: {
            '1sg': { pl: 'idę', audioUrl: 'https://a/1sg.mp3' },
            '2sg': { pl: 'idziesz' },
          },
        },
      })
    );
    expect(queuedJobs().map((j) => j.fieldPath)).toEqual(['conjugations.present.2sg.audioUrl']);
  });

  test('an edit queues only the forms whose text changed, even if they had audio', async () => {
    const before = verb({
      infinitiveAudioUrl: 'https://a/inf.mp3',
      conjugations: {
        present: {
          '1sg': { pl: 'idę', audioUrl: 'https://a/1sg.mp3' },
          '2sg': { pl: 'idzisz', audioUrl: 'https://a/2sg.mp3' },
        },
      },
    });
    const after = verb({
      infinitiveAudioUrl: 'https://a/inf.mp3',
      conjugations: {
        present: {
          '1sg': { pl: 'idę', audioUrl: 'https://a/1sg.mp3' },
          '2sg': { pl: 'idziesz', audioUrl: 'https://a/2sg.mp3' },
        },
      },
    });

    await writeVerb(before, after);
    expect(queuedJobs()).toEqual([
      {
        fieldPath: 'conjugations.present.2sg.audioUrl',
        text: 'idziesz',
        audioType: 'conjugation',
        subPath: 'isc_present_2sg',
      },
    ]);
  });

  test('a form or tense added by an edit is queued', async () => {
    const before = verb({ conjugations: { present: { '1sg': { pl: 'idę' } } } });
    const after = verb({
      conjugations: {
        present: { '1sg': { pl: 'idę' }, '3sg': { pl: 'idzie' } },
        imperative: { '2sg': { pl: 'idź' } },
      },
    });

    await writeVerb(before, after);
    expect(queuedJobs().map((j) => j.fieldPath)).toEqual([
      'conjugations.present.3sg.audioUrl',
      'conjugations.imperative.2sg.audioUrl',
    ]);
  });

  test('a changed infinitive is queued and text is trimmed', async () => {
    await writeVerb(verb(), verb({ infinitive: '  pójść ' }));
    expect(queuedJobs()).toEqual([
      { fieldPath: 'infinitiveAudioUrl', text: 'pójść', audioType: 'verb-infinitive' },
    ]);
  });

  test('an edit that changes no Polish text queues nothing and writes nothing', async () => {
    await writeVerb(
      verb(),
      verb({
        infinitiveEn: 'to go',
        conjugations: {
          present: { '1sg': { pl: ' idę ', en: ['I go'] }, '2sg': { pl: 'idziesz' } },
          past: { '1sg_f': { pl: 'szłam' } },
        },
      })
    );
    expect(tasks.enqueued).toEqual([]);
    expect(db.writes).toEqual([]);
  });

  test('the task’s own audio URL writes do not queue more work', async () => {
    const withAudio = verb({
      infinitiveAudioUrl: 'https://a/inf.mp3',
      audioStatus: 'ready',
      conjugations: {
        present: { '1sg': { pl: 'idę', audioUrl: 'https://a/1sg.mp3' }, '2sg': { pl: 'idziesz' } },
        past: { '1sg_f': { pl: 'szłam' } },
      },
    });
    await writeVerb(verb({ audioStatus: 'generating' }), withAudio);
    expect(tasks.enqueued).toEqual([]);
  });

  test('forms without Polish text are skipped', async () => {
    await writeVerb(
      undefined,
      verb({ infinitive: '', conjugations: { present: { '1sg': { pl: '  ' }, '2sg': {} } } })
    );
    expect(tasks.enqueued).toEqual([]);
  });

  test('deleting a verb does nothing', async () => {
    await writeVerb(verb(), undefined);
    expect(tasks.enqueued).toEqual([]);
    expect(db.writes).toEqual([]);
  });

  test('a failure to queue the jobs is recorded on the verb', async () => {
    tasks.failure = new Error('Cloud Tasks unavailable');
    await expect(writeVerb(undefined, verb())).resolves.toBeUndefined();
    expect(db.data('verbs/isc')).toMatchObject({
      audioStatus: 'error',
      audioError: 'Cloud Tasks unavailable',
    });
  });

  test('jobs are still queued when marking the verb generating fails', async () => {
    db.failWrites({ op: 'update', path: 'verbs/isc' }, new Error('contention'), true);
    await writeVerb(undefined, verb());
    expect(queuedJobs()).toHaveLength(4);
  });
});

describe('generateVerbAudio', () => {
  const jobs: Job[] = [
    { fieldPath: 'infinitiveAudioUrl', text: 'iść', audioType: 'verb-infinitive' },
    {
      fieldPath: 'conjugations.present.1sg.audioUrl',
      text: 'idę',
      audioType: 'conjugation',
      subPath: 'isc_present_1sg',
    },
    {
      fieldPath: 'conjugations.past.1sg_f.audioUrl',
      text: 'szłam',
      audioType: 'conjugation',
      subPath: 'isc_past_1sg_f',
    },
  ];
  const run = (jobList: Job[] = jobs) =>
    runTask(generateVerbAudio, { docId: 'isc', jobs: jobList });
  const seedVerb = () =>
    db.seed('verbs/isc', {
      ...verb({ audioStatus: 'generating', audioError: 'old' }),
      conjugations: {
        present: { '1sg': { pl: 'idę', en: ['I go'] } },
        past: { '1sg_f': { pl: 'szłam' } },
      },
    });

  test('stores every form’s audio and marks the verb ready', async () => {
    seedVerb();
    await run();

    expect(storage.file(AUDIO_BUCKET, 'verb-infinitives/isc.mp3')?.data).toEqual(
      Buffer.from('mp3(iść)')
    );
    expect(storage.file(AUDIO_BUCKET, 'conjugation/isc_past_1sg_f.mp3')?.data).toEqual(
      Buffer.from('mp3(szłam)')
    );
    const stored = db.data('verbs/isc') as {
      infinitiveAudioUrl: string;
      audioStatus: string;
      conjugations: Record<string, Record<string, Record<string, unknown>>>;
    };
    expect(stored.infinitiveAudioUrl).toContain('verb-infinitives/isc.mp3');
    expect(stored.conjugations.present['1sg']).toEqual({
      pl: 'idę',
      en: ['I go'],
      audioUrl: expect.stringContaining('conjugation/isc_present_1sg.mp3'),
    });
    expect(stored.conjugations.past['1sg_f'].audioUrl).toContain('conjugation/isc_past_1sg_f.mp3');
    expect(stored.audioStatus).toBe('ready');
    expect(stored).not.toHaveProperty('audioError');
  });

  test('keeps the audio that worked and reports the jobs that failed', async () => {
    seedVerb();
    tts.respond = (text) => (text === 'idę' ? new Error('quota exceeded') : Buffer.from(text));

    await run();
    const stored = db.data('verbs/isc') as Record<string, unknown>;
    expect(stored.infinitiveAudioUrl).toContain('verb-infinitives/isc.mp3');
    expect(stored.audioStatus).toBe('error');
    expect(stored.audioError).toBe(
      '1 of 3 job(s) failed: conjugations.present.1sg.audioUrl: quota exceeded'
    );
  });

  test('counts empty TTS audio as a failed job', async () => {
    seedVerb();
    tts.respond = (text) => (text === 'iść' ? null : Buffer.from(text));

    await run();
    expect(db.data('verbs/isc')?.audioError).toBe(
      '1 of 3 job(s) failed: infinitiveAudioUrl: empty TTS response'
    );
  });

  test('lists at most five failures in the error message', async () => {
    db.seed('verbs/isc', { infinitive: 'iść' });
    const many: Job[] = Array.from({ length: 7 }, (_, i) => ({
      fieldPath: `conjugations.present.f${i}.audioUrl`,
      text: `forma${i}`,
      audioType: 'conjugation',
      subPath: `isc_present_f${i}`,
    }));
    tts.respond = (text) => (text === 'forma6' ? Buffer.from(text) : new Error('boom'));

    await run(many);
    const message = db.data('verbs/isc')?.audioError as string;
    expect(message.startsWith('6 of 7 job(s) failed: ')).toBe(true);
    expect(message.match(/: boom/g)).toHaveLength(5);
    expect(message.endsWith(' (+1 more)')).toBe(true);
  });

  test('records the failure and throws so Cloud Tasks retries when every job fails', async () => {
    seedVerb();
    tts.respond = () => new Error('TTS down');

    await expect(run()).rejects.toThrow('All 3 verb audio jobs failed for verbs/isc');
    expect(db.data('verbs/isc')).toMatchObject({
      audioStatus: 'error',
      audioError: expect.stringMatching(/^3 of 3 job\(s\) failed/),
    });
  });

  test('throws when the verb no longer exists, so nothing is silently lost', async () => {
    await expect(run()).rejects.toThrow(/NOT_FOUND/);
  });

  test('a verb with no jobs is simply marked ready', async () => {
    db.seed('verbs/isc', { infinitive: 'iść', audioStatus: 'generating' });
    await run([]);
    expect(db.data('verbs/isc')).toEqual({ infinitive: 'iść', audioStatus: 'ready' });
  });
});
