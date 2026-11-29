import { describe, expect, test, vi } from 'vitest';
import {
  createCustomCollectionStorage,
  syncPendingCustomCards,
} from '../../src/lib/storage/createCustomCollectionStorage';
import {
  customVocabularyStorage,
  loadCustomVocabulary,
} from '../../src/lib/storage/customVocabulary';
import { customSentenceStorage, loadCustomSentences } from '../../src/lib/storage/customSentences';
import {
  customDeclensionStorage,
  loadCustomDeclension,
  subscribeCustomDeclension,
} from '../../src/lib/storage/customDeclension';
import { findWordWithSamePolish } from '../../src/lib/utils/findDuplicateCustomVocabularyPolish';
import { findCustomSentenceWithSamePolish } from '../../src/lib/utils/findDuplicateCustomSentence';
import { findCustomDeclensionDuplicate } from '../../src/lib/utils/findDuplicateCustomDeclension';
import { syncAllPendingToFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import { syncAllPendingReviewCards } from '../../src/lib/storage/reviewStorageRegistry';
import type { CustomVocabularyWord } from '../../src/types/vocabulary';
import type { CustomSentence } from '../../src/types/sentences';
import type { CustomDeclensionCard } from '../../src/types';
import { remote } from './support/fakeFirestore';
import { network, settle, setupSyncTests, signIn, userPath } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

const UID = 'learner-a';
const vocabPath = userPath(UID, 'customVocabulary');

const word = (id: string, polish: string, extra: Partial<CustomVocabularyWord> = {}) =>
  ({
    id,
    isCustom: true,
    createdAt: 1,
    polish,
    english: `${polish} (en)`,
    ...extra,
  }) as CustomVocabularyWord;

const sentence = (id: string, polish: string): CustomSentence => ({
  id,
  isCustom: true,
  createdAt: 1,
  polish,
  english: 'x',
  level: 'A1',
  tags: [],
});

const declension = (
  id: string,
  front: string,
  extra: Partial<CustomDeclensionCard> = {}
): CustomDeclensionCard => ({
  id,
  isCustom: true,
  createdAt: 1,
  front,
  back: 'b',
  declined: 'kota',
  case: 'Genitive',
  gender: 'Masculine',
  number: 'Singular',
  ...extra,
});

const vocabStorage = () => createCustomCollectionStorage<CustomVocabularyWord>('customVocabulary');

/** Subscribe and resolve with the first list the listener delivers. */
const nextDelivery = <T>(subscribe: (cb: (items: T[]) => void) => () => void) =>
  new Promise<T[]>((resolve) => {
    const unsubscribe = subscribe((items) => {
      unsubscribe();
      resolve(items);
    });
  });

const ids = (items: Array<{ id: string }>) => items.map((i) => i.id).sort();

describe('adding, editing and deleting while online', () => {
  test('an added item is stored locally and on the server', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));

    expect(await vocabStorage().load()).toEqual([word('custom_1', 'kot')]);
    expect(remote.get(`${vocabPath}/custom_1`)).toEqual(word('custom_1', 'kot'));
  });

  test('optional fields left undefined are dropped instead of failing the server write', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot', { notes: undefined, gender: undefined }));

    expect(remote.get(`${vocabPath}/custom_1`)).toEqual(word('custom_1', 'kot'));
  });

  test('an edit changes only the given fields, locally and on the server', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot', { notes: 'pet' }));

    await vocabStorage().update('custom_1', { english: 'cat' });

    const expected = word('custom_1', 'kot', { notes: 'pet', english: 'cat' });
    expect(await vocabStorage().load()).toEqual([expected]);
    expect(remote.get(`${vocabPath}/custom_1`)).toEqual(expected);
  });

  test('editing an item that is not in the local cache does nothing', async () => {
    signIn(UID);
    await vocabStorage().update('custom_404', { english: 'cat' });

    expect(await vocabStorage().load()).toEqual([]);
    expect(remote.calls).toEqual([]);
  });

  test('a deleted item is removed locally and on the server', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));
    await vocabStorage().add(word('custom_2', 'pies'));

    await vocabStorage().delete('custom_1');

    expect(ids(await vocabStorage().load())).toEqual(['custom_2']);
    expect(Object.keys(remote.list(vocabPath))).toEqual(['custom_2']);
  });

  // A refused write (e.g. permission-denied) would fail again on every retry; the SDK
  // waits rather than rejects while offline.
  test('a rejected server write surfaces the error and leaves the device as it was', async () => {
    signIn(UID);
    remote.fail({ op: 'setDoc' });

    await expect(vocabStorage().add(word('custom_1', 'kot'))).rejects.toThrow();
    expect(await vocabStorage().load()).toEqual([]);

    // Nothing is left pending to be sent later.
    remote.clearFailures();
    expect(await syncPendingCustomCards()).toBe(0);
    expect(remote.list(vocabPath)).toEqual({});
  });

  test('a rejected edit or delete restores the item as it was', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot', { notes: 'pet' }));
    remote.fail({ op: ['updateDoc', 'deleteDoc'] });

    await expect(
      vocabStorage().update('custom_1', { english: 'cat', notes: undefined })
    ).rejects.toThrow();
    await expect(vocabStorage().delete('custom_1')).rejects.toThrow();

    expect(await vocabStorage().load()).toEqual([word('custom_1', 'kot', { notes: 'pet' })]);
    remote.clearFailures();
    expect(await syncPendingCustomCards()).toBe(0);
    expect(remote.get(`${vocabPath}/custom_1`)).toEqual(word('custom_1', 'kot', { notes: 'pet' }));
  });

  test('clearing an optional field in an edit removes it on the server too', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot', { notes: 'old note' }));

    await vocabStorage().update('custom_1', { notes: undefined });

    expect(remote.get(`${vocabPath}/custom_1`)).not.toHaveProperty('notes');
    expect(await vocabStorage().load()).toEqual([word('custom_1', 'kot')]);
  });

  test('an edit leaves the fields it does not change as the server has them', async () => {
    signIn(UID);
    await customDeclensionStorage.add(declension('a', 'kot'));
    // Another device changes the hint meanwhile.
    remote.seed(`${userPath(UID, 'customDeclension')}/a`, declension('a', 'kot', { hint: 'pet' }));

    await customDeclensionStorage.update('a', { number: 'Plural' });

    expect(remote.get(`${userPath(UID, 'customDeclension')}/a`)).toEqual(
      declension('a', 'kot', { hint: 'pet', number: 'Plural' })
    );
  });
});

describe('the storage for each kind of custom item', () => {
  test('custom vocabulary is stored trimmed and lower-cased, when added and when edited', async () => {
    signIn(UID);
    await customVocabularyStorage.add(word('custom_1', '  Kot ', { english: ' Cat' }));

    expect(await loadCustomVocabulary()).toEqual([word('custom_1', 'kot', { english: 'cat' })]);
    expect(remote.get(`${vocabPath}/custom_1`)).toMatchObject({ polish: 'kot', english: 'cat' });

    await customVocabularyStorage.update('custom_1', { english: ' House Cat ' });

    expect(await loadCustomVocabulary()).toEqual([
      word('custom_1', 'kot', { english: 'house cat' }),
    ]);
    expect(remote.get(`${vocabPath}/custom_1`)).toMatchObject({ english: 'house cat' });
  });

  test('each kind of custom item lives in its own collection', async () => {
    signIn(UID);
    await customVocabularyStorage.add(word('custom_1', 'kot'));
    await customSentenceStorage.add(sentence('custom_2', 'Mam kota.'));

    expect(ids(await loadCustomVocabulary())).toEqual(['custom_1']);
    expect(ids(await loadCustomSentences())).toEqual(['custom_2']);
    expect(await loadCustomDeclension()).toEqual([]);

    await customVocabularyStorage.delete('custom_1');
    expect(ids(await loadCustomSentences())).toEqual(['custom_2']);
  });
});

describe('guest', () => {
  test('items are kept on this device only and never sent', async () => {
    await vocabStorage().add(word('custom_1', 'kot'));
    await vocabStorage().update('custom_1', { english: 'cat' });

    expect(await vocabStorage().load()).toEqual([word('custom_1', 'kot', { english: 'cat' })]);

    await vocabStorage().delete('custom_1');
    expect(await vocabStorage().load()).toEqual([]);
    expect(remote.calls).toEqual([]);
  });

  test('subscribing does not open a server listener', async () => {
    const unsubscribe = vocabStorage().subscribe(() => {});
    unsubscribe();

    expect(remote.listenerCount).toBe(0);
    expect(remote.calls).toEqual([]);
  });
});

describe('live updates from the server', () => {
  test('delivers items added and removed on another device', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));
    remote.remove(`${vocabPath}/custom_1`);
    remote.seed(`${vocabPath}/custom_2`, word('custom_2', 'pies'));

    const delivered = await nextDelivery(vocabStorage().subscribe);

    expect(ids(delivered)).toEqual(['custom_2']);
    expect(ids(await vocabStorage().load())).toEqual(['custom_2']);
  });

  test('keeps an item whose upload is still pending', async () => {
    signIn(UID);
    network.goOffline();
    await vocabStorage().add(word('custom_1', 'kot'));
    network.goOnline();

    const delivered = await nextDelivery(vocabStorage().subscribe);

    expect(ids(delivered)).toEqual(['custom_1']);
  });

  test('keeps delivering changes until unsubscribed', async () => {
    signIn(UID);
    const seen: string[][] = [];
    const unsubscribe = subscribeCustomDeclension((items) => seen.push(ids(items)));
    await vi.waitFor(() => expect(seen).toEqual([[]]));

    remote.seed(`${userPath(UID, 'customDeclension')}/a`, declension('a', 'kot'));
    await vi.waitFor(() => expect(seen).toEqual([[], ['a']]));

    unsubscribe();
    remote.seed(`${userPath(UID, 'customDeclension')}/b`, declension('b', 'pies'));
    await settle();
    expect(seen).toEqual([[], ['a']]);
  });
});

describe('changes made offline', () => {
  test('are visible on this device straight away without calling the server', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));
    await vocabStorage().add(word('custom_2', 'pies'));
    network.goOffline();
    remote.calls.length = 0;

    await vocabStorage().add(word('custom_3', 'koń'));
    await vocabStorage().update('custom_1', { english: 'cat' });
    await vocabStorage().delete('custom_2');

    expect(await vocabStorage().load()).toEqual([
      word('custom_1', 'kot', { english: 'cat' }),
      word('custom_3', 'koń'),
    ]);
    expect(remote.calls).toEqual([]);
  });

  test('an item added offline reaches the server once back online', async () => {
    signIn(UID);
    network.goOffline();
    await vocabStorage().add(word('custom_1', 'kot'));

    // Everything the app runs on reconnect and on its background sync.
    network.goOnline();
    await Promise.all([syncAllPendingToFirestore(), syncAllPendingReviewCards()]);
    await nextDelivery(vocabStorage().subscribe);
    await settle();

    expect(remote.get(`${vocabPath}/custom_1`)).toEqual(word('custom_1', 'kot'));
  });

  test('an item deleted offline stays deleted after reconnecting', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));
    network.goOffline();
    await vocabStorage().delete('custom_1');

    network.goOnline();
    const delivered = await nextDelivery(vocabStorage().subscribe);

    expect(delivered).toEqual([]);
  });

  test('an item edited offline keeps the edit after reconnecting', async () => {
    signIn(UID);
    await vocabStorage().add(word('custom_1', 'kot'));
    network.goOffline();
    await vocabStorage().update('custom_1', { english: 'cat' });

    network.goOnline();
    const delivered = await nextDelivery(vocabStorage().subscribe);

    expect(delivered).toEqual([word('custom_1', 'kot', { english: 'cat' })]);
  });
});

describe('duplicate detection', () => {
  test('vocabulary: the same Polish word ignoring case, spacing and punctuation is a duplicate', () => {
    const words = [word('custom_1', 'dzień dobry')];

    expect(findWordWithSamePolish(words, '  Dzień   Dobry! ')?.id).toBe('custom_1');
    expect(findWordWithSamePolish(words, 'dzień')).toBeUndefined();
  });

  test('vocabulary: a word is not a duplicate of itself while being edited', () => {
    const words = [word('custom_1', 'kot'), word('custom_2', 'pies')];

    expect(findWordWithSamePolish(words, 'kot', 'custom_1')).toBeUndefined();
    expect(findWordWithSamePolish(words, 'kot', 'custom_2')?.id).toBe('custom_1');
  });

  test('vocabulary and sentences: blank input is never a duplicate', () => {
    expect(findWordWithSamePolish([word('custom_1', '')], '  ')).toBeUndefined();
    expect(findCustomSentenceWithSamePolish([sentence('s', '')], ' ')).toBeUndefined();
  });

  test('sentences: matches ignoring case and spacing, but not a different sentence', () => {
    const sentences = [sentence('s1', 'Mam  kota.')];

    expect(findCustomSentenceWithSamePolish(sentences, ' mam kota. ')?.id).toBe('s1');
    expect(findCustomSentenceWithSamePolish(sentences, 'Mam psa.')).toBeUndefined();
    expect(findCustomSentenceWithSamePolish(sentences, 'mam kota.', 's1')).toBeUndefined();
  });

  test('declension: a duplicate needs the same word, form, case, gender and number', () => {
    const cards = [declension('a', 'Nie mam ___')];
    const same = { ...declension('x', ' nie  MAM ___ ') };

    expect(findCustomDeclensionDuplicate(cards, same)?.id).toBe('a');
    expect(findCustomDeclensionDuplicate(cards, { ...same, case: 'Accusative' })).toBeUndefined();
    expect(findCustomDeclensionDuplicate(cards, { ...same, number: 'Plural' })).toBeUndefined();
    expect(findCustomDeclensionDuplicate(cards, { ...same, declined: 'kotów' })).toBeUndefined();
    expect(findCustomDeclensionDuplicate(cards, same, 'a')).toBeUndefined();
  });

  test('a duplicate check against the stored items sees what was saved', async () => {
    signIn(UID);
    await customVocabularyStorage.add(word('custom_1', 'Kot'));

    expect(findWordWithSamePolish(await loadCustomVocabulary(), 'KOT')?.id).toBe('custom_1');
  });
});
