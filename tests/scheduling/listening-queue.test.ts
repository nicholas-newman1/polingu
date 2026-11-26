import { beforeEach, describe, expect, test } from 'vitest';
import { createEmptyCard, type Card } from 'ts-fsrs';
import {
  buildDeclensionListeningQueue,
  buildSentenceListeningQueue,
  buildVocabularyListeningQueue,
} from '../../src/lib/listeningScheduler';
import orderListeningPool from '../../src/lib/listeningScheduler/orderListeningPool';
import type { ListeningOrdering } from '../../src/types/listening';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import type { Sentence, SentenceReviewDataStore } from '../../src/types/sentences';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import { freezeTime, graduated, learning, relearning, TODAY } from './fixtures';
import { stub } from '../helpers/stub';

beforeEach(() => freezeTime());

interface Entry {
  item: { id: string; isCustom?: boolean; createdAt?: number };
  reviewData: { fsrsCard: Card };
}

const entry = (id: string, fsrsCard?: Card, extra: Partial<Entry['item']> = {}): Entry => ({
  item: { id, ...extra },
  reviewData: { fsrsCard: fsrsCard ?? createEmptyCard() },
});

/** A pool covering every stage a card can be at. */
const pool = () => [
  entry('unseen'),
  entry('overdue-3d', graduated(-3)),
  entry('learning-due-1-min-ago', learning(-1)),
  entry('learning-in-10-min', learning(10)),
  entry('relearning-overdue', relearning(-60)),
  entry('graduated-in-2d', graduated(2)),
  entry('graduated-in-9d', graduated(9)),
];

const order = (ordering: ListeningOrdering, entries = pool(), limit?: number) =>
  orderListeningPool(entries, ordering, limit).map((e) => e.item.id);

describe('listening order', () => {
  test('"due" plays only started cards that are due, most overdue first', () => {
    expect(order('due')).toEqual(['overdue-3d', 'relearning-overdue', 'learning-due-1-min-ago']);
  });

  test('"practice ahead" plays started cards not yet due, soonest first', () => {
    expect(order('practice-ahead')).toEqual([
      'learning-in-10-min',
      'graduated-in-2d',
      'graduated-in-9d',
    ]);
  });

  test('"learned" plays only graduated cards, due or not', () => {
    expect(order('learned').sort()).toEqual(['graduated-in-2d', 'graduated-in-9d', 'overdue-3d']);
  });

  test('"random" plays every card once, unseen ones included', () => {
    const ids = order('random');
    expect(ids).toHaveLength(pool().length);
    expect(ids.slice().sort()).toEqual(
      pool()
        .map((e) => e.item.id)
        .sort()
    );
  });

  test('"recently added" plays custom cards newest first, then built-in ones last-listed first', () => {
    const entries = [
      entry('system-oldest'),
      entry('custom-march', undefined, { isCustom: true, createdAt: Date.parse('2026-03-01') }),
      entry('system-middle'),
      entry('custom-no-date', undefined, { isCustom: true }),
      entry('custom-november', undefined, { isCustom: true, createdAt: Date.parse('2026-11-01') }),
      entry('system-newest'),
    ];

    expect(order('recently-added', entries)).toEqual([
      'custom-november',
      'custom-march',
      'custom-no-date',
      'system-newest',
      'system-middle',
      'system-oldest',
    ]);
  });

  test('a limit keeps the first cards of the chosen order', () => {
    expect(order('due', pool(), 2)).toEqual(['overdue-3d', 'relearning-overdue']);
    expect(order('random', pool(), 3)).toHaveLength(3);
    expect(order('random', pool(), 0)).toEqual([]);
  });

  test('ordering does not reorder the caller’s list', () => {
    const entries = pool();
    const before = entries.map((e) => e.item.id);
    order('recently-added', entries);
    order('due', entries);
    order('random', entries);
    expect(entries.map((e) => e.item.id)).toEqual(before);
  });
});

describe('vocabulary listening queue', () => {
  const words = [
    stub<VocabularyWord>({ id: 1, polish: 'dom', english: 'house', audioUrl: 'a/1.mp3' }),
    stub<VocabularyWord>({ id: 2, polish: 'kot', english: 'cat' }),
    stub<VocabularyWord>({ id: 3, polish: 'pies', english: 'dog', audioUrl: 'a/3.mp3' }),
  ];
  const store = () =>
    stub<VocabularyReviewDataStore>({
      // Keys are strings once stored, even for numeric word ids.
      cards: { '3': { wordId: 3, fsrsCard: graduated(-1) } },
      reviewedToday: [],
      newCardsToday: [],
      lastReviewDate: TODAY,
    });

  test('only words with audio are queued, each marked learned or not', () => {
    const queue = buildVocabularyListeningQueue({
      words,
      reviewStore: store(),
      ordering: 'recently-added',
    });

    expect(queue).toEqual([
      {
        id: 'vocabulary:3',
        feature: 'vocabulary',
        audioUrl: 'a/3.mp3',
        primaryText: 'pies',
        secondaryText: 'dog',
        isLearned: true,
      },
      {
        id: 'vocabulary:1',
        feature: 'vocabulary',
        audioUrl: 'a/1.mp3',
        primaryText: 'dom',
        secondaryText: 'house',
        isLearned: false,
      },
    ]);
  });

  test('"due" uses the learner’s review data to pick words', () => {
    const queue = buildVocabularyListeningQueue({ words, reviewStore: store(), ordering: 'due' });
    expect(queue.map((i) => i.id)).toEqual(['vocabulary:3']);
  });
});

describe('sentence listening queue', () => {
  const sentence = (id: string, level: Sentence['level'], audioUrl?: string) =>
    stub<Sentence>({ id, level, audioUrl, polish: `pl ${id}`, english: `en ${id}` });
  const sentences = [
    sentence('a1', 'A1', 'a1.mp3'),
    sentence('b1', 'B1', 'b1.mp3'),
    sentence('b1-silent', 'B1'),
    sentence('c1', 'C1', 'c1.mp3'),
  ];
  const store = stub<SentenceReviewDataStore>({
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: TODAY,
  });

  test('only sentences with audio at the selected levels are queued', () => {
    const queue = buildSentenceListeningQueue({
      sentences,
      reviewStore: store,
      ordering: 'random',
      levels: ['B1', 'C1'],
    });
    expect(queue.map((i) => i.id).sort()).toEqual(['sentence:b1', 'sentence:c1']);
    expect(queue.find((i) => i.id === 'sentence:b1')).toMatchObject({
      feature: 'sentences',
      primaryText: 'pl b1',
      secondaryText: 'en b1',
      isLearned: false,
    });
  });

  test('no level selection means every level', () => {
    for (const levels of [undefined, []]) {
      const queue = buildSentenceListeningQueue({
        sentences,
        reviewStore: store,
        ordering: 'random',
        levels,
      });
      expect(queue).toHaveLength(3);
    }
  });

  test('a limit caps the queue', () => {
    expect(
      buildSentenceListeningQueue({ sentences, reviewStore: store, ordering: 'random', limit: 2 })
    ).toHaveLength(2);
  });
});

describe('declension listening queue', () => {
  const card = (id: number, overrides: Partial<DeclensionCard>) =>
    stub<DeclensionCard>({
      id,
      front: `front ${id}`,
      back: `back ${id}`,
      declined: `declined ${id}`,
      audioUrl: `${id}.mp3`,
      case: 'Genitive',
      gender: 'Feminine',
      number: 'Singular',
      ...overrides,
    });
  const cards = [
    card(1, {}),
    card(2, { case: 'Dative' }),
    card(3, { gender: 'Masculine', number: 'Plural' }),
    card(4, { audioUrl: undefined }),
  ];
  const store = () =>
    stub<DeclensionReviewDataStore>({
      cards: { 1: { cardId: 1, fsrsCard: graduated(3) } },
      reviewedToday: [],
      newCardsToday: [],
      lastReviewDate: TODAY,
    });
  const ids = (filters?: Parameters<typeof buildDeclensionListeningQueue>[0]['filters']) =>
    buildDeclensionListeningQueue({ cards, reviewStore: store(), ordering: 'random', filters })
      .map((i) => i.id)
      .sort();

  test('queues cards with audio that match the filters', () => {
    expect(ids()).toEqual(['declension:1', 'declension:2', 'declension:3']);
    expect(ids({ cases: [], genders: [], number: 'All' })).toEqual([
      'declension:1',
      'declension:2',
      'declension:3',
    ]);
    expect(ids({ cases: ['Genitive'] })).toEqual(['declension:1', 'declension:3']);
    expect(ids({ genders: ['Masculine'] })).toEqual(['declension:3']);
    expect(ids({ number: 'Singular' })).toEqual(['declension:1', 'declension:2']);
  });

  test('shows the declined form with the prompt and answer', () => {
    const [item] = buildDeclensionListeningQueue({
      cards,
      reviewStore: store(),
      ordering: 'practice-ahead',
    });
    expect(item).toEqual({
      id: 'declension:1',
      feature: 'declension',
      audioUrl: '1.mp3',
      primaryText: 'declined 1',
      secondaryText: 'front 1 → back 1',
      isLearned: true,
    });
  });
});
