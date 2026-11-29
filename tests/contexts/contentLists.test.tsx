/**
 * The card lists the review contexts expose: built-in content, the learner's
 * custom items (kept live from the server), and the setters pages use to change them.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { remote } from '../sync/support/fakeFirestore';
import { freezeTime, setupSyncTests, userPath } from '../sync/support/harness';
import type { ReviewData } from '../hooks/support/reviewDataProviders';
import type { CustomVocabularyWord } from '../../src/types/vocabulary';
import type { CustomSentence } from '../../src/types/sentences';
import type { CustomDeclensionCard } from '../../src/types';
import {
  renderReviewDataProvider,
  renderReviewProviders,
  type InitialData,
} from './support/render';
import { declensionCard, freshUid, sentence, verb, word } from './support/fixtures';
import { idle, seedContent } from './support/server';

vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));

setupSyncTests();

const NOW = '2026-11-26T19:00:00-05:00';

// Fixtures date their cards from now, so the clock is frozen before any is made.
beforeEach(() => freezeTime(NOW));
// Let snapshot handlers and the full provider's background sync finish before the
// next test resets IndexedDB, whose rows are not keyed by account.
afterEach(() => act(idle));
const ids = (items: Array<{ id: string | number }>) => items.map((item) => String(item.id));

interface CustomList {
  name: string;
  collection: string;
  customItem(id: string): { id: string };
  /** Initial data with one built-in item, `builtin`. */
  initial: InitialData;
  custom(data: ReviewData): Array<{ id: string | number }>;
  all(data: ReviewData): Array<{ id: string | number }>;
}

const customBase = (id: string) => ({ id, isCustom: true as const, createdAt: 1 });

const CUSTOM_LISTS: CustomList[] = [
  {
    name: 'vocabulary',
    collection: 'customVocabulary',
    customItem: (id): CustomVocabularyWord => ({ ...customBase(id), polish: id, english: id }),
    initial: { vocabulary: { initialSystemWords: [word('builtin')] } },
    custom: (data) => data.vocabulary.customWords,
    all: (data) => data.vocabulary.words,
  },
  {
    name: 'sentences',
    collection: 'customSentences',
    customItem: (id): CustomSentence => ({
      ...customBase(id),
      polish: id,
      english: id,
      level: 'A1',
      tags: [],
    }),
    initial: { sentences: { initialSystemSentences: [sentence('builtin')] } },
    custom: (data) => data.sentences.customSentences,
    all: (data) => data.sentences.sentences,
  },
  {
    name: 'declension',
    collection: 'customDeclension',
    customItem: (id): CustomDeclensionCard => ({
      ...customBase(id),
      front: id,
      back: id,
      declined: id,
      case: 'Genitive',
      gender: 'Feminine',
      number: 'Singular',
    }),
    initial: { declension: { initialSystemCards: [declensionCard('builtin')] } },
    custom: (data) => data.declension.customCards,
    all: (data) => data.declension.cards,
  },
];

describe.each(CUSTOM_LISTS.map((list) => [list.name, list] as const))(
  '%s custom items',
  (_name, list) => {
    const seedCustom = (uid: string, id: string) =>
      remote.seed(userPath(uid, list.collection, id), list.customItem(id));

    test('signed in, the ones on the server appear ahead of the built-in ones and follow other devices’ changes', async () => {
      const uid = freshUid();
      seedCustom(uid, 'custom_1');

      const h = renderReviewProviders(uid, list.initial);
      await waitFor(() => expect(ids(list.all(h.data()))).toEqual(['custom_1', 'builtin']));

      act(() => seedCustom(uid, 'custom_2'));
      await waitFor(() => expect(ids(list.custom(h.data()))).toEqual(['custom_1', 'custom_2']));

      act(() => remote.remove(userPath(uid, list.collection, 'custom_1')));
      await waitFor(() => expect(ids(list.all(h.data()))).toEqual(['custom_2', 'builtin']));
    });

    test('after switching accounts, only the new account’s custom items arrive', async () => {
      const ania = freshUid('ania');
      const bartek = freshUid('bartek');
      seedCustom(ania, 'ania_1');
      seedCustom(bartek, 'bartek_1');
      const h = renderReviewProviders(ania, list.initial);
      await waitFor(() => expect(ids(list.custom(h.data()))).toEqual(['ania_1']));

      act(() => h.switchUser(bartek));
      await waitFor(() => expect(ids(list.custom(h.data()))).toEqual(['bartek_1']));
      act(() => seedCustom(ania, 'ania_2'));
      await act(idle);

      expect(ids(list.custom(h.data()))).not.toContain('ania_2');
    });

    // On a new device the first load reads the custom items from the empty cache, but
    // it is applied only once every load is done (here: held on a server read), after
    // the listener has delivered them.
    test('the first load, read before the listener delivered them, does not hide them', async () => {
      const uid = freshUid();
      seedContent({ sentences: [sentence('s1')] });
      seedCustom(uid, 'custom_1');
      const load = remote.hold('getDocsFromServer');
      const h = renderReviewDataProvider(uid);
      await waitFor(() => expect(ids(list.custom(h.data()))).toEqual(['custom_1']));
      // The load's other server reads go out first, so the next hold catches the sync's.
      await act(idle);

      // Pauses the background sync that follows the load, before it reads the cache again.
      const sync = remote.hold('getDocsFromServer');
      load.release();
      await waitFor(() => expect(h.data().loading).toBe(false));
      expect(ids(list.custom(h.data()))).toEqual(['custom_1']);

      sync.release();
      await act(idle);
      expect(ids(list.custom(h.data()))).toEqual(['custom_1']);
    });
  }
);

describe('custom item listeners', () => {
  test('signed in, one is opened per custom collection and closed on unmount', async () => {
    const h = renderReviewProviders(freshUid());
    expect(remote.listenerCount).toBe(3);

    h.unmount();
    expect(remote.listenerCount).toBe(0);
  });

  test('signed out, none is opened', () => {
    renderReviewProviders(null);
    expect(remote.listenerCount).toBe(0);
  });
});

describe('replacing lists', () => {
  test('vocabulary: custom and built-in words are replaced separately, custom words listed first', () => {
    const h = renderReviewProviders(null, { vocabulary: { initialSystemWords: [word('w1')] } });

    act(() =>
      h.data().vocabulary.setCustomWords([{ ...customBase('c1'), polish: 'c1', english: 'c1' }])
    );
    act(() => h.data().vocabulary.setSystemWords([word('w2'), word('w3')]));

    expect(ids(h.data().vocabulary.customWords)).toEqual(['c1']);
    expect(ids(h.data().vocabulary.systemWords)).toEqual(['w2', 'w3']);
    expect(ids(h.data().vocabulary.words)).toEqual(['c1', 'w2', 'w3']);
  });

  test('declension: custom and built-in cards are replaced separately, custom cards listed first', () => {
    const h = renderReviewProviders(null, {
      declension: { initialSystemCards: [declensionCard(1)] },
    });

    act(() =>
      h.data().declension.setCustomCards([CUSTOM_LISTS[2].customItem('c1') as CustomDeclensionCard])
    );
    act(() => h.data().declension.setSystemCards([declensionCard(2)]));

    expect(ids(h.data().declension.cards)).toEqual(['c1', '2']);
  });

  test('sentences: custom and built-in sentences are replaced separately, custom sentences listed first', () => {
    const h = renderReviewProviders(null, {
      sentences: { initialSystemSentences: [sentence('s1')] },
    });

    act(() =>
      h.data().sentences.setCustomSentences([CUSTOM_LISTS[1].customItem('c1') as CustomSentence])
    );
    act(() => h.data().sentences.setSystemSentences([sentence('s2')]));

    expect(ids(h.data().sentences.sentences)).toEqual(['c1', 's2']);
  });

  test('sentences: setSentences with the full list shows each sentence once', () => {
    const h = renderReviewProviders(null, {
      sentences: {
        initialCustomSentences: [CUSTOM_LISTS[1].customItem('c1') as CustomSentence],
        initialSystemSentences: [sentence('s1')],
      },
    });

    act(() => h.data().sentences.setSentences([...h.data().sentences.sentences, sentence('s2')]));

    expect(ids(h.data().sentences.sentences)).toEqual(['c1', 's1', 's2']);
  });

  test('conjugation: setVerbs replaces the verbs', () => {
    const h = renderReviewProviders(null, { conjugation: { initialVerbs: [verb('robić')] } });

    act(() => h.data().conjugation.setVerbs([verb('mieć')]));

    expect(ids(h.data().conjugation.verbs)).toEqual(['mieć']);
  });
});

describe('aspect pair cards', () => {
  test('are rebuilt when a load brings new verbs', () => {
    const h = renderReviewProviders(null, {
      aspectPairs: { verbs: [verb('robić', { aspectPair: 'zrobić' }), verb('zrobić')] },
    });
    expect(h.data().aspectPairs.cards).toHaveLength(1);

    h.provide({
      aspectPairs: { verbs: [verb('pisać', { aspectPair: 'napisać' }), verb('napisać')] },
    });

    expect(h.data().aspectPairs.cards.map((c) => c.verb.id)).toEqual(['pisać']);
  });

  /** The full provider, loaded with one aspect pair: robić and zrobić. */
  async function renderLoadedPair() {
    seedContent({
      verbs: [verb('robić', { aspectPair: 'zrobić' }), verb('zrobić', { aspectPair: 'robić' })],
      sentences: [sentence('s1')],
    });
    const h = renderReviewDataProvider(freshUid());
    await waitFor(() => expect(h.data().loading).toBe(false));
    await act(idle);
    return h;
  }

  test('after a load, are built from the loaded verbs', async () => {
    const h = await renderLoadedPair();

    expect(h.data().aspectPairs.cards.map((c) => [c.verb.id, c.pairVerb.infinitive])).toEqual([
      ['robić', 'zrobić'],
    ]);
  });

  test('follow verbs edited through the conjugation context', async () => {
    const h = await renderLoadedPair();

    const { conjugation } = h.data();
    act(() =>
      conjugation.setVerbs(
        conjugation.verbs.map((v) => (v.id === 'zrobić' ? { ...v, infinitive: 'zrobić!' } : v))
      )
    );

    expect(h.data().aspectPairs.cards[0].pairVerb.infinitive).toBe('zrobić!');
  });
});
