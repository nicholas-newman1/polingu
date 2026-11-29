import { describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_TAGS,
  loadSentenceTags,
  refreshSentenceTagsFromFirestore,
  saveSentenceTags,
} from '../../src/lib/storage/sentenceTags';
import {
  assignNewSentenceIds,
  createSentence,
  deleteSentence,
  updateSentence,
  updateSentenceTranslation,
} from '../../src/lib/storage/systemSentences';
import {
  deleteSystemVocabularyWord,
  updateSystemVocabularyWord,
} from '../../src/lib/storage/systemVocabulary';
import { deleteVerb, updateVerb } from '../../src/lib/storage/systemVerbs';
import {
  deleteDeclensionCard,
  updateDeclensionCard,
  updateDeclensionCardTranslation,
} from '../../src/lib/storage/systemDeclension';
import type { Sentence } from '../../src/types/sentences';
import { remote, Timestamp } from './support/fakeFirestore';
import { freezeTime, network, setupSyncTests, signIn } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

describe('sentence tags (shared configuration)', () => {
  test('are fetched once and then served from the cache, even offline', async () => {
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: ['past'], style: [] });

    expect(await loadSentenceTags()).toEqual({ topics: ['food'], grammar: ['past'], style: [] });
    network.goOffline();
    expect(await loadSentenceTags()).toEqual({ topics: ['food'], grammar: ['past'], style: [] });
  });

  test('missing lists default to empty', async () => {
    remote.seed('config/sentenceTags', { topics: ['food'] });

    expect(await loadSentenceTags()).toEqual({ topics: ['food'], grammar: [], style: [] });
  });

  test('when the server cannot be reached and nothing is cached, the defaults are used and the next load retries', async () => {
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: [], style: [] });
    remote.fail({ op: 'getDoc' }, { times: 1 });

    expect(await loadSentenceTags()).toEqual(DEFAULT_TAGS);
    expect(await loadSentenceTags()).toEqual({ topics: ['food'], grammar: [], style: [] });
  });

  test('a background refresh picks up tags edited elsewhere; offline it does nothing', async () => {
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: [], style: [] });
    await loadSentenceTags();
    remote.seed('config/sentenceTags', { topics: ['food', 'travel'], grammar: [], style: [] });

    network.goOffline();
    await refreshSentenceTagsFromFirestore();
    expect((await loadSentenceTags()).topics).toEqual(['food']);

    network.goOnline();
    await refreshSentenceTagsFromFirestore();
    expect((await loadSentenceTags()).topics).toEqual(['food', 'travel']);
  });

  test('saving updates the cache and the shared doc', async () => {
    signIn();
    const tags = { topics: ['home'], grammar: ['aspect'], style: ['formal'] };

    await saveSentenceTags(tags);

    expect(remote.get('config/sentenceTags')).toEqual(tags);
    network.goOffline();
    expect(await loadSentenceTags()).toEqual(tags);
  });
});

describe('admin edits to built-in content', () => {
  test('a field cleared in an edit is deleted from the document', async () => {
    remote.seed('vocabulary/1', { id: 1, polish: 'kot', english: 'cat', notes: 'old' });
    remote.seed('verbs/robic', { id: 'robic', infinitive: 'robić', aspectPair: 'zrobic' });
    remote.seed('declensionCards/3', { id: 3, front: 'f', hint: 'old' });
    remote.seed('sentences/a1_1', { id: 'a1_1', polish: 'x', english: 'y', audioUrl: 'old' });

    await updateSystemVocabularyWord(1, { english: 'a cat', notes: undefined });
    await updateVerb('robic', { aspectPair: undefined });
    await updateDeclensionCard(3, { hint: undefined, front: 'g' });
    await updateSentence('a1_1', { english: 'z', audioUrl: undefined });

    expect(remote.get('vocabulary/1')).toEqual({ id: 1, polish: 'kot', english: 'a cat' });
    expect(remote.get('verbs/robic')).toEqual({ id: 'robic', infinitive: 'robić' });
    expect(remote.get('declensionCards/3')).toEqual({ id: 3, front: 'g' });
    expect(remote.get('sentences/a1_1')).toEqual({ id: 'a1_1', polish: 'x', english: 'z' });
  });

  test('a word translation is added without touching the other translations', async () => {
    remote.seed('sentences/a1_1', { id: 'a1_1', translations: { kot: 'cat' } });
    remote.seed('declensionCards/3', { id: 3, translations: { kot: 'cat' } });

    await updateSentenceTranslation('a1_1', 'pies', 'dog');
    await updateDeclensionCardTranslation(3, 'pies', 'dog');

    expect(remote.get('sentences/a1_1')).toEqual({
      id: 'a1_1',
      translations: { kot: 'cat', pies: 'dog' },
    });
    expect(remote.get('declensionCards/3')).toEqual({
      id: 3,
      translations: { kot: 'cat', pies: 'dog' },
    });
  });

  test('a new sentence is stamped with the server time', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    const sentence: Sentence = {
      id: 'a1_9',
      polish: 'Mam kota.',
      english: 'I have a cat.',
      level: 'A1',
      tags: [],
    };

    await createSentence(sentence);

    const stored = remote.get('sentences/a1_9') as unknown as Sentence & { createdAt: Timestamp };
    expect(stored).toMatchObject(sentence);
    expect(stored.createdAt.toMillis()).toBe(Date.parse('2026-11-26T10:00:00-05:00'));
  });

  test('new sentence ids continue from the server list, including sentences added elsewhere', async () => {
    remote.seed('sentences/b1_009', { id: 'b1_009' });
    remote.seed('sentences/b1_010', { id: 'b1_010' });
    remote.seed('sentences/a1_002', { id: 'a1_002' });

    const assigned = await assignNewSentenceIds([
      { polish: 'Idę.', english: 'I go.', level: 'B1' as const },
      { polish: 'Jem.', english: 'I eat.', level: 'B1' as const },
      { polish: 'Śpię.', english: 'I sleep.', level: 'C1' as const },
    ]);

    expect(assigned.map((s) => s.id)).toEqual(['b1_011', 'b1_012', 'c1_001']);
  });

  test('updating and deleting a built-in sentence', async () => {
    remote.seed('sentences/a1_1', { id: 'a1_1', polish: 'x', english: 'y' });
    remote.seed('sentences/a1_2', { id: 'a1_2', polish: 'x', english: 'y' });
    remote.seed('vocabulary/1', { id: 1 });
    remote.seed('verbs/robic', { id: 'robic' });
    remote.seed('declensionCards/3', { id: 3 });

    await updateSentence('a1_1', { english: 'z' });
    await deleteSentence('a1_2');
    await deleteSystemVocabularyWord(1);
    await deleteVerb('robic');
    await deleteDeclensionCard(3);

    expect(remote.list('sentences')).toEqual({ a1_1: { id: 'a1_1', polish: 'x', english: 'z' } });
    expect(remote.list('vocabulary')).toEqual({});
    expect(remote.list('verbs')).toEqual({});
    expect(remote.list('declensionCards')).toEqual({});
  });
});
