import { describe, expect, test, vi } from 'vitest';
import { refreshAllUserDataFromFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import type { TranslationDirection } from '../../src/types/common';
import { remote } from './support/fakeFirestore';
import { freezeTime, ratedCard, setupSyncTests, signIn, userPath } from './support/harness';
import {
  aspectPairsStorage,
  clearDeckProgress,
  conjugationStorage,
  declensionStorage,
  loadDeckSettings,
  loadReviewStore,
  saveDeckSettings,
  saveReviewStore,
  sentenceStorage,
  vocabularyStorage,
} from '../../src/lib/storage/reviewDeckStorage';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

const UID = 'learner-a';
const TODAY = '2026-11-26';
const data = (name: string) => remote.get(userPath(UID, 'data', name));
const cardsOnServer = (name: string) => Object.keys(remote.list(userPath(UID, name)));

/** What a reload does before the page shows data again: the background refresh from the server. */
const reloadApp = () => refreshAllUserDataFromFirestore();

async function studyDeclension() {
  await saveReviewStore(declensionStorage.all, null, {
    cards: { 1: { cardId: 1, fsrsCard: ratedCard(new Date()) } },
    reviewedToday: [1],
    newCardsToday: [1],
    lastReviewDate: TODAY,
  });
  await saveDeckSettings(declensionStorage.all, { newCardsPerDay: 25 });
}

async function studyVocabulary(direction: TranslationDirection) {
  await saveReviewStore(vocabularyStorage[direction], null, {
    cards: { 7: { wordId: 7, fsrsCard: ratedCard(new Date()) } },
    reviewedToday: [7],
    newCardsToday: [7],
    lastReviewDate: TODAY,
  });
}

async function studyAspectPairs() {
  await saveReviewStore(aspectPairsStorage.all, null, {
    cards: { v: { verbId: 'v', fsrsCard: ratedCard(new Date()) } },
    reviewedToday: ['v'],
    newCardsToday: ['v'],
    lastReviewDate: TODAY,
  });
  await saveDeckSettings(aspectPairsStorage.all, { newCardsPerDay: 3 });
}

describe('resetting declension progress', () => {
  test('removes the cards, session counters and settings from the server and the cards locally', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyDeclension();

    await clearDeckProgress(declensionStorage.all);

    expect(cardsOnServer('declensionReviewCards')).toEqual([]);
    expect(data('declensionReviewSession')).toBeUndefined();
    expect(data('settings')).toBeUndefined();
    expect((await loadReviewStore(declensionStorage.all)).cards).toEqual({});
  });

  test('leaves other features alone', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyDeclension();
    await studyAspectPairs();

    await clearDeckProgress(declensionStorage.all);

    expect(cardsOnServer('aspectPairsReviewCards')).toEqual(['v']);
    expect(Object.keys((await loadReviewStore(aspectPairsStorage.all)).cards)).toEqual(['v']);
    expect(data('aspectPairsSettings')).toEqual({ newCardsPerDay: 3 });
  });

  test('settings are back to the defaults after the app is reloaded', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyDeclension();

    await clearDeckProgress(declensionStorage.all);
    await reloadApp();

    expect(await loadDeckSettings(declensionStorage.all)).toEqual({ newCardsPerDay: 10 });
  });

  test("today's counters are empty after the app is reloaded the same day", async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyDeclension();

    await clearDeckProgress(declensionStorage.all);
    await reloadApp();

    expect(await loadReviewStore(declensionStorage.all)).toMatchObject({
      reviewedToday: [],
      newCardsToday: [],
    });
  });

  test('a reset that fails on the server is reported to the caller', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyDeclension();
    remote.fail({ op: 'batch.commit' });

    await expect(clearDeckProgress(declensionStorage.all)).rejects.toThrow();
  });
});

describe('resetting a feature studied in two directions', () => {
  test('vocabulary: only the chosen direction is cleared', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyVocabulary('pl-to-en');
    await studyVocabulary('en-to-pl');

    await clearDeckProgress(vocabularyStorage['pl-to-en']);

    expect(cardsOnServer('vocabularyReviewCards-pl-en')).toEqual([]);
    expect(data('vocabularyReviewSession-pl-en')).toBeUndefined();
    expect(cardsOnServer('vocabularyReviewCards-en-pl')).toEqual(['7']);
    expect(data('vocabularyReviewSession-en-pl')).toMatchObject({ reviewedToday: [7] });
    expect(Object.keys((await loadReviewStore(vocabularyStorage['en-to-pl'])).cards)).toEqual([
      '7',
    ]);
    expect((await loadReviewStore(vocabularyStorage['pl-to-en'])).cards).toEqual({});
  });

  test("vocabulary: today's counters are empty after a reset and a reload", async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyVocabulary('pl-to-en');

    await clearDeckProgress(vocabularyStorage['pl-to-en']);
    await reloadApp();

    expect(await loadReviewStore(vocabularyStorage['pl-to-en'])).toMatchObject({
      cards: {},
      reviewedToday: [],
      newCardsToday: [],
    });
  });

  test('sentences: only the chosen direction is cleared', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    for (const direction of ['pl-to-en', 'en-to-pl'] as const) {
      await saveReviewStore(sentenceStorage[direction], null, {
        cards: { s: { sentenceId: 's', fsrsCard: ratedCard(new Date()) } },
        reviewedToday: ['s'],
        newCardsToday: ['s'],
        lastReviewDate: TODAY,
      });
    }

    await clearDeckProgress(sentenceStorage['en-to-pl']);

    expect(cardsOnServer('sentenceReviewCards-en-pl')).toEqual([]);
    expect(cardsOnServer('sentenceReviewCards-pl-en')).toEqual(['s']);
    expect(data('sentenceReviewSession-en-pl')).toBeUndefined();
    expect(data('sentenceReviewSession-pl-en')).toMatchObject({ reviewedToday: ['s'] });
  });

  test('conjugation: clears the forms, session and settings of one direction', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    for (const direction of ['pl-to-en', 'en-to-pl'] as const) {
      await saveReviewStore(conjugationStorage[direction], null, {
        cards: {
          'robic:present:1sg': { formKey: 'robic:present:1sg', fsrsCard: ratedCard(new Date()) },
        },
        reviewedToday: ['robic:present:1sg'],
        newCardsToday: ['robic:present:1sg'],
        lastReviewDate: TODAY,
      });
      await saveDeckSettings(conjugationStorage[direction], { newCardsPerDay: 3 });
    }

    await clearDeckProgress(conjugationStorage['pl-to-en']);

    expect(cardsOnServer('conjugationReviewForms-pl-en')).toEqual([]);
    expect(data('conjugationReviewSession-pl-en')).toBeUndefined();
    expect(data('conjugationSettings-pl-en')).toBeUndefined();
    expect(cardsOnServer('conjugationReviewForms-en-pl')).toEqual(['robic:present:1sg']);
    expect(data('conjugationSettings-en-pl')).toEqual({ newCardsPerDay: 3 });
  });

  test('conjugation: a server failure is reported to the caller', async () => {
    signIn(UID);
    remote.fail({ op: 'deleteDoc' });

    await expect(clearDeckProgress(conjugationStorage['pl-to-en'])).rejects.toThrow();
  });
});

describe('resetting aspect pairs', () => {
  test('removes the cards, session and settings', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn(UID);
    await studyAspectPairs();

    await clearDeckProgress(aspectPairsStorage.all);

    expect(cardsOnServer('aspectPairsReviewCards')).toEqual([]);
    expect(data('aspectPairsReviewSession')).toBeUndefined();
    expect(data('aspectPairsSettings')).toBeUndefined();
    expect((await loadReviewStore(aspectPairsStorage.all)).cards).toEqual({});
  });
});

describe('guest', () => {
  test('every reset is a no-op that never reaches the server', async () => {
    await clearDeckProgress(declensionStorage.all);
    await clearDeckProgress(vocabularyStorage['pl-to-en']);
    await clearDeckProgress(sentenceStorage['pl-to-en']);
    await clearDeckProgress(conjugationStorage['pl-to-en']);
    await clearDeckProgress(aspectPairsStorage.all);

    expect(remote.calls).toEqual([]);
  });
});
