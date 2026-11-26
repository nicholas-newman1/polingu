/**
 * Vocabulary examples are mirrored as sentence cards (one per example), and edits
 * to a mirror sentence flow back into the example. These tests run the deployed
 * triggers for both directions, built-in and custom.
 */
import { describe, expect, test, vi } from 'vitest';
import { onVocabularyExamplesWrite } from '../../src/triggers/firestore/onVocabularyExamplesWrite.js';
import { onCustomVocabularyExamplesWrite } from '../../src/triggers/firestore/onCustomVocabularyExamplesWrite.js';
import { onSentenceVocabLinkWrite } from '../../src/triggers/firestore/onSentenceVocabLinkWrite.js';
import { onCustomSentenceVocabLinkWrite } from '../../src/triggers/firestore/onCustomSentenceVocabLinkWrite.js';
import { customMirrorSentenceIdFor, mirrorSentenceIdFor } from '../../src/shared/vocabMirror.js';
import { FieldValue } from '../support/fakeFirestore.js';
import { db, installFakes, openai } from '../support/sdk.js';
import { runDocumentWrite } from '../support/invoke.js';

vi.mock('firebase-admin/app', () => import('../support/sdk.js').then((m) => m.adminApp));
vi.mock('firebase-admin/firestore', () =>
  import('../support/sdk.js').then((m) => m.adminFirestore)
);
vi.mock('firebase-admin/storage', () => import('../support/sdk.js').then((m) => m.adminStorage));
vi.mock('openai', () => import('../support/sdk.js').then((m) => m.openaiModule));

installFakes();

type Example = { id?: string; polish?: string; english?: string };

const VOCAB_PATTERN = 'vocabulary/{wordId}';
const SENTENCE_PATTERN = 'sentences/{sentenceId}';
const CUSTOM_VOCAB_PATTERN = 'users/{userId}/customVocabulary/{wordId}';
const CUSTOM_SENTENCE_PATTERN = 'users/{userId}/customSentences/{sentenceId}';

const kot = { id: 'e1', polish: 'Mam kota.', english: 'I have a cat.' };
const pies = { id: 'e2', polish: 'Mam psa.', english: 'I have a dog.' };

const vocab = (examples: Example[] | undefined, extra: Record<string, unknown> = {}) => ({
  polish: 'kot',
  english: 'cat',
  ...(examples && { examples }),
  ...extra,
});

function writeVocab(before: Example[] | undefined | null, after: Example[] | undefined | null) {
  return runDocumentWrite(
    onVocabularyExamplesWrite,
    VOCAB_PATTERN,
    'vocabulary/w1',
    before === null ? undefined : vocab(before),
    after === null ? undefined : vocab(after)
  );
}

const mirrorPath = (exampleId: string) => `sentences/${mirrorSentenceIdFor('w1', exampleId)}`;

/** The model rates every sentence `level`. */
function cefrAlways(level: string | null | Error) {
  openai.replyAlways(() => level);
}

describe('mirror ids', () => {
  test('built-in and custom mirrors use distinct, stable ids', () => {
    expect(mirrorSentenceIdFor('w1', 'e1')).toBe('vocab-w1-e1');
    expect(customMirrorSentenceIdFor('w1', 'e1')).toBe('custom_vocab-w1-e1');
  });
});

describe('onVocabularyExamplesWrite', () => {
  test('creates a levelled mirror sentence for each new example', async () => {
    cefrAlways('A1');
    await writeVocab([], [kot, pies]);

    expect(db.data(mirrorPath('e1'))).toEqual({
      id: 'vocab-w1-e1',
      createdAt: FieldValue.serverTimestamp(),
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
      tags: ['vocab-example'],
      source: 'vocab-example',
      sourceVocabularyId: 'w1',
      sourceExampleId: 'e1',
    });
    expect(db.data(mirrorPath('e2'))).toMatchObject({ polish: 'Mam psa.', sourceExampleId: 'e2' });
    expect(openai.chatRequests.map((r) => r.messages.at(-1)?.content).sort()).toEqual([
      'Mam kota.',
      'Mam psa.',
    ]);
  });

  test('creates mirrors when a word is created with examples', async () => {
    cefrAlways('A2');
    await writeVocab(null, [kot]);
    expect(db.data(mirrorPath('e1'))?.level).toBe('A2');
  });

  test('trims the example text it copies', async () => {
    cefrAlways('A1');
    await writeVocab([], [{ id: 'e1', polish: '  Mam kota. ', english: ' I have a cat.\n' }]);
    expect(db.data(mirrorPath('e1'))).toMatchObject({
      polish: 'Mam kota.',
      english: 'I have a cat.',
    });
  });

  test.each([
    ['the model gives no usable level', 'I think B1'],
    ['the model call fails', new Error('OpenAI down')],
  ])('skips creating the mirror when %s', async (_case, reply) => {
    cefrAlways(reply);
    await writeVocab([], [kot]);
    expect(db.data(mirrorPath('e1'))).toBeUndefined();
  });

  test('skips creating the mirror when no OpenAI key is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await writeVocab([], [kot]);
    expect(db.data(mirrorPath('e1'))).toBeUndefined();
    expect(openai.chatRequests).toHaveLength(0);
  });

  test.each([
    ['without an id', { polish: 'Mam kota.', english: 'I have a cat.' }],
    ['without Polish', { id: 'e1', polish: '  ', english: 'I have a cat.' }],
    ['without English', { id: 'e1', polish: 'Mam kota.' }],
  ])('ignores an example %s', async (_case, example) => {
    cefrAlways('A1');
    await writeVocab([], [example]);
    expect(db.childPaths('sentences')).toEqual([]);
  });

  test('updates the mirror text and re-levels it when the Polish changes', async () => {
    db.seed(mirrorPath('e1'), {
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
      tags: ['vocab-example'],
    });
    cefrAlways('B1');

    await writeVocab(
      [kot],
      [{ ...kot, polish: 'Miałem kiedyś kota.', english: 'I once had a cat.' }]
    );
    expect(db.data(mirrorPath('e1'))).toEqual({
      polish: 'Miałem kiedyś kota.',
      english: 'I once had a cat.',
      level: 'B1',
      tags: ['vocab-example'],
    });
  });

  test('updates only the English without re-levelling when the Polish is unchanged', async () => {
    db.seed(mirrorPath('e1'), { polish: 'Mam kota.', english: 'I have a cat.', level: 'A1' });

    await writeVocab([kot], [{ ...kot, english: 'I’ve got a cat.' }]);
    expect(db.data(mirrorPath('e1'))).toEqual({
      polish: 'Mam kota.',
      english: 'I’ve got a cat.',
      level: 'A1',
    });
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('keeps the old level when re-levelling an edited mirror fails', async () => {
    db.seed(mirrorPath('e1'), { polish: 'Mam kota.', english: 'I have a cat.', level: 'A1' });
    cefrAlways(new Error('OpenAI down'));

    await writeVocab([kot], [{ ...kot, polish: 'Mam dwa koty.' }]);
    expect(db.data(mirrorPath('e1'))).toMatchObject({ polish: 'Mam dwa koty.', level: 'A1' });
  });

  test('recreates a mirror that was deleted when its example is edited', async () => {
    cefrAlways('A2');
    await writeVocab([kot], [{ ...kot, polish: 'Mam dwa koty.' }]);
    expect(db.data(mirrorPath('e1'))).toMatchObject({ polish: 'Mam dwa koty.', level: 'A2' });
  });

  test('does nothing when the examples did not change', async () => {
    await runDocumentWrite(
      onVocabularyExamplesWrite,
      VOCAB_PATTERN,
      'vocabulary/w1',
      vocab([kot]),
      vocab([{ ...kot, polish: ` ${kot.polish} ` }], { audioUrl: 'https://a/kot.mp3' })
    );
    expect(db.writes).toEqual([]);
    expect(openai.chatRequests).toHaveLength(0);
  });

  test('does not rewrite a mirror that already matches the example', async () => {
    db.seed(mirrorPath('e1'), { polish: 'Mam kota.', english: 'I have a cat.', level: 'A1' });
    await writeVocab([], [kot]);
    expect(db.writes).toEqual([]);
  });

  test('deletes the mirror of a removed example and leaves the others', async () => {
    db.seed(mirrorPath('e1'), { polish: kot.polish });
    db.seed(mirrorPath('e2'), { polish: pies.polish });

    await writeVocab([kot, pies], [pies]);
    expect(db.data(mirrorPath('e1'))).toBeUndefined();
    expect(db.data(mirrorPath('e2'))).toBeDefined();
  });

  test('deletes every mirror when the word is deleted', async () => {
    db.seed(mirrorPath('e1'), { polish: kot.polish });
    db.seed(mirrorPath('e2'), { polish: pies.polish });

    await writeVocab([kot, pies], null);
    expect(db.childPaths('sentences')).toEqual([]);
  });

  test('a failed mirror delete does not stop the other examples syncing', async () => {
    db.seed(mirrorPath('e1'), { polish: kot.polish });
    db.failWrites({ op: 'delete', path: mirrorPath('e1') });
    cefrAlways('A1');

    await writeVocab([kot], [pies]);
    expect(db.data(mirrorPath('e2'))).toBeDefined();
  });

  test('a failed mirror write does not fail the trigger', async () => {
    db.failWrites({ op: 'set' });
    cefrAlways('A1');
    await expect(writeVocab([], [kot])).resolves.toBeUndefined();
  });
});

describe('onCustomVocabularyExamplesWrite', () => {
  const customMirror = (exampleId: string) =>
    `users/u1/customSentences/${customMirrorSentenceIdFor('w1', exampleId)}`;

  test('creates the mirror in the owner’s custom sentences, marked custom', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_800_000_000_000);
    cefrAlways('A1');

    await runDocumentWrite(
      onCustomVocabularyExamplesWrite,
      CUSTOM_VOCAB_PATTERN,
      'users/u1/customVocabulary/w1',
      vocab([]),
      vocab([kot])
    );

    expect(db.data(customMirror('e1'))).toEqual({
      id: 'custom_vocab-w1-e1',
      isCustom: true,
      createdAt: 1_800_000_000_000,
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
      tags: ['vocab-example'],
      source: 'vocab-example',
      sourceVocabularyId: 'w1',
      sourceExampleId: 'e1',
    });
    expect(db.childPaths('sentences')).toEqual([]);
  });

  test('deletes the owner’s mirror when the example is removed', async () => {
    db.seed(customMirror('e1'), { polish: kot.polish });
    db.seed(`users/u2/customSentences/${customMirrorSentenceIdFor('w1', 'e1')}`, { polish: 'x' });

    await runDocumentWrite(
      onCustomVocabularyExamplesWrite,
      CUSTOM_VOCAB_PATTERN,
      'users/u1/customVocabulary/w1',
      vocab([kot]),
      vocab([])
    );
    expect(db.data(customMirror('e1'))).toBeUndefined();
    expect(db.childPaths('users/u2/customSentences')).toHaveLength(1);
  });
});

describe('onSentenceVocabLinkWrite', () => {
  const mirror = (fields: Record<string, unknown> = {}) => ({
    polish: kot.polish,
    english: kot.english,
    source: 'vocab-example',
    sourceVocabularyId: 'w1',
    sourceExampleId: 'e1',
    ...fields,
  });

  function writeSentence(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined,
    path = 'sentences/vocab-w1-e1'
  ) {
    return runDocumentWrite(onSentenceVocabLinkWrite, SENTENCE_PATTERN, path, before, after);
  }

  test('copies an edit of a mirror sentence back into its example', async () => {
    db.seed('vocabulary/w1', vocab([kot, pies]));

    await writeSentence(
      mirror(),
      mirror({ polish: ' Mam kotkę. ', english: 'I have a female cat.' })
    );
    expect(db.data('vocabulary/w1')?.examples).toEqual([
      { id: 'e1', polish: 'Mam kotkę.', english: 'I have a female cat.' },
      pies,
    ]);
  });

  test('keeps other fields of the example when copying an edit back', async () => {
    db.seed('vocabulary/w1', vocab([{ ...kot, meaning: 'pet' } as Example]));

    await writeSentence(mirror(), mirror({ english: 'I own a cat.' }));
    expect(db.data('vocabulary/w1')?.examples).toEqual([
      { id: 'e1', polish: 'Mam kota.', english: 'I own a cat.', meaning: 'pet' },
    ]);
  });

  test('removes the example when its mirror sentence is deleted', async () => {
    db.seed('vocabulary/w1', vocab([kot, pies]));

    await writeSentence(mirror(), undefined);
    expect(db.data('vocabulary/w1')?.examples).toEqual([pies]);
  });

  test('does not touch the word when the mirror’s text did not change', async () => {
    db.seed('vocabulary/w1', vocab([kot]));

    await writeSentence(mirror(), mirror({ level: 'B1', audioUrl: 'https://a/x.mp3' }));
    expect(db.writes).toEqual([]);
  });

  test('does not touch the word when the example already has the edited text', async () => {
    db.seed('vocabulary/w1', vocab([{ ...kot, polish: 'Mam kotkę.' }]));

    await writeSentence(mirror(), mirror({ polish: 'Mam kotkę.' }));
    expect(db.writes).toEqual([]);
  });

  test.each([
    ['a sentence that is not a vocab example', { source: 'manual' }],
    ['a mirror missing its example id', { sourceExampleId: undefined }],
    ['an edit that blanks the Polish', { polish: '   ' }],
  ])('ignores %s', async (_case, fields) => {
    db.seed('vocabulary/w1', vocab([kot]));

    await writeSentence(mirror(), mirror({ ...fields, english: 'Changed.' }));
    expect(db.data('vocabulary/w1')?.examples).toEqual([kot]);
  });

  test('ignores deletion of an ordinary sentence', async () => {
    db.seed('vocabulary/w1', vocab([kot]));
    await writeSentence({ polish: 'Mam kota.', source: 'manual' }, undefined, 'sentences/s9');
    expect(db.writes).toEqual([]);
  });

  test('does nothing when the word or example no longer exists', async () => {
    db.seed('vocabulary/w1', vocab([pies]));
    await writeSentence(mirror(), mirror({ english: 'Changed.' }));
    await writeSentence(mirror({ sourceVocabularyId: 'w2' }), undefined, 'sentences/vocab-w2-e1');
    expect(db.writes).toEqual([]);
  });

  test('a failure updating the word does not fail the trigger', async () => {
    db.seed('vocabulary/w1', vocab([kot]));
    db.failWrites({ op: 'update' });
    await expect(writeSentence(mirror(), undefined)).resolves.toBeUndefined();
  });

  test('an edit round trip settles: the example update does not rewrite the mirror again', async () => {
    db.seed('vocabulary/w1', vocab([kot]));
    const edited = mirror({ english: 'I own a cat.' });
    await writeSentence(mirror(), edited);
    const vocabAfter = db.data('vocabulary/w1')!;

    db.writes.length = 0;
    await runDocumentWrite(
      onVocabularyExamplesWrite,
      VOCAB_PATTERN,
      'vocabulary/w1',
      vocab([kot]),
      vocabAfter
    );
    expect(db.writes).toEqual([]);
  });

  test('a removal round trip settles: deleting the mirror does not rewrite the word', async () => {
    // Removing an example deletes its mirror, whose deletion fires this trigger.
    db.seed(mirrorPath('e1'), mirror());
    await writeVocab([kot, pies], [pies]);
    expect(db.data(mirrorPath('e1'))).toBeUndefined();

    db.writes.length = 0;
    await writeSentence(mirror(), undefined);
    expect(db.writes).toEqual([]);
    expect(db.data('vocabulary/w1')?.examples).toEqual([pies]);
  });
});

describe('onCustomSentenceVocabLinkWrite', () => {
  test('copies an edit back into the owner’s custom word only', async () => {
    db.seed('users/u1/customVocabulary/w1', vocab([kot]));
    db.seed('users/u2/customVocabulary/w1', vocab([kot]));
    const link = {
      source: 'vocab-example',
      sourceVocabularyId: 'w1',
      sourceExampleId: 'e1',
      isCustom: true,
    };

    await runDocumentWrite(
      onCustomSentenceVocabLinkWrite,
      CUSTOM_SENTENCE_PATTERN,
      'users/u1/customSentences/custom_vocab-w1-e1',
      { ...link, polish: kot.polish, english: kot.english },
      { ...link, polish: kot.polish, english: 'I own a cat.' }
    );

    expect(db.data('users/u1/customVocabulary/w1')?.examples).toEqual([
      { ...kot, english: 'I own a cat.' },
    ]);
    expect(db.data('users/u2/customVocabulary/w1')?.examples).toEqual([kot]);
    expect(db.data('vocabulary/w1')).toBeUndefined();
  });
});
