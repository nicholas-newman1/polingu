/**
 * The due counts shown on the dashboard and as navigation badges. A badge
 * promises the learner a session of that size, so each count should match what
 * the feature's session would actually serve.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from '@testing-library/react';
import { freezeTime, setTime, setupSyncTests } from '../sync/support/harness';
import getVocabularySessionCards from '../../src/lib/vocabularyScheduler/getVocabularySessionCards';
import getSentenceSessionCards from '../../src/lib/sentenceScheduler/getSentenceSessionCards';
import getDeclensionSessionCards from '../../src/lib/declensionScheduler/getSessionCards';
import getConjugationSessionCards from '../../src/lib/conjugationScheduler/getConjugationSessionCards';
import getAspectPairsSessionCards from '../../src/lib/aspectPairsScheduler/getAspectPairsSessionCards';
import { startDayIfNeeded } from '../../src/lib/reviewSession/sessionLists';
import { getTodayString } from '../../src/lib/storage/helpers';
import type { DeclensionFilters } from '../../src/lib/declensionScheduler/types';
import type { ConjugationFilters } from '../../src/types/conjugation';
import { DEFAULT_USER_FILTERS, type UserFilters } from '../../src/types/userFilters';
import { renderReviewProviders, type InitialData } from './support/render';
import {
  aspectPairsStore,
  conjugationStore,
  declensionCard,
  declensionStore,
  dueCard,
  formKey,
  freshUid,
  fsrsCard,
  notDueCard,
  sentence,
  sentenceStore,
  State,
  verb,
  vocabularyStore,
  withWordRated,
  word,
} from './support/fixtures';
import { idle, seedUserDoc } from './support/server';

vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));

setupSyncTests();

const NOW = '2026-11-26T19:00:00-05:00';

// Fixtures date their cards from now, so the clock is frozen before any is made.
beforeEach(() => freezeTime(NOW));

const sessionSize = (session: { reviewCards: unknown[]; newCards: unknown[] }) =>
  session.reviewCards.length + session.newCards.length;

function renderCounts(initial: InitialData, uid: string | null = freshUid()) {
  const h = renderReviewProviders(uid, initial);
  return { h, counts: () => h.data().counts };
}

/**
 * pl-to-en: w1 due, w2 graduated and not due, w3 still in learning (not due yet),
 * w4 due but already reviewed today; w2 was introduced today, so one of the two
 * new words (w5, w6) is left in an allowance of 2. en-to-pl: nothing studied.
 */
function vocabularyScenario(): InitialData['vocabulary'] {
  return {
    initialSystemWords: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map((id) => word(id)),
    initialReviewStores: {
      'pl-to-en': vocabularyStore(
        {
          w1: dueCard(),
          w2: notDueCard(),
          w3: fsrsCard(State.Learning, new Date(Date.now() + 600_000)),
          w4: dueCard(),
        },
        { reviewedToday: ['w4'], newCardsToday: ['w2'] }
      ),
      'en-to-pl': vocabularyStore(),
    },
    initialSettings: { 'pl-to-en': { newCardsPerDay: 2 }, 'en-to-pl': { newCardsPerDay: 4 } },
  };
}

describe('review counts', () => {
  test('signed out, every count is zero even with cards due', () => {
    const { counts } = renderCounts({ vocabulary: vocabularyScenario() }, null);

    expect(counts()).toEqual({
      declension: 0,
      vocabulary: 0,
      sentences: 0,
      conjugation: 0,
      aspectPairs: 0,
    });
  });

  test('vocabulary: due and learning cards plus new words up to what is left of the allowance, both directions added', () => {
    const { counts } = renderCounts({ vocabulary: vocabularyScenario() });

    // pl-to-en: w1 and w3 to review, plus 1 of 2 new words; en-to-pl: 4 of 6 new words.
    expect(counts().vocabulary).toBe(3 + 4);
  });

  test('vocabulary: matches the sessions the learner would get', () => {
    const scenario = vocabularyScenario()!;
    const { counts } = renderCounts({ vocabulary: scenario });

    const words = scenario.initialSystemWords!;
    const expected = (['pl-to-en', 'en-to-pl'] as const).reduce(
      (sum, direction) =>
        sum +
        sessionSize(
          getVocabularySessionCards(
            words,
            scenario.initialReviewStores![direction],
            scenario.initialSettings![direction]
          )
        ),
      0
    );
    expect(counts().vocabulary).toBe(expected);
  });

  test('new cards already introduced beyond the allowance leave only the reviews', () => {
    const { counts } = renderCounts({
      vocabulary: {
        initialSystemWords: [word('w1'), word('w2'), word('w3')],
        initialReviewStores: {
          'pl-to-en': vocabularyStore(
            { w1: dueCard(), w2: notDueCard() },
            { newCardsToday: ['w2', 'x', 'y'] }
          ),
          'en-to-pl': vocabularyStore({ w1: notDueCard(), w2: notDueCard(), w3: notDueCard() }),
        },
        initialSettings: { 'pl-to-en': { newCardsPerDay: 2 }, 'en-to-pl': { newCardsPerDay: 2 } },
      },
    });

    expect(counts().vocabulary).toBe(1);
  });

  test('sentences: only sentences at the levels selected for that direction count', () => {
    const sentences = [
      sentence('a1-new', 'A1'),
      sentence('b1-new', 'B1'),
      sentence('b1-due', 'B1'),
    ];
    const scenario: InitialData['sentences'] = {
      initialSystemSentences: sentences,
      initialReviewStores: {
        'pl-to-en': sentenceStore({ 'b1-due': dueCard() }),
        'en-to-pl': sentenceStore({ 'b1-due': dueCard() }),
      },
      initialSettings: {
        'pl-to-en': { newCardsPerDay: 5, selectedLevels: ['A1'] },
        'en-to-pl': { newCardsPerDay: 5, selectedLevels: ['A1', 'B1'] },
      },
    };
    const { counts } = renderCounts({ sentences: scenario });

    expect(counts().sentences).toBe(1 + 3);
    // The sentences page builds each session from the sentences at the selected levels.
    const session = (direction: 'pl-to-en' | 'en-to-pl') => {
      const settings = scenario.initialSettings![direction];
      return getSentenceSessionCards(
        sentences.filter((s) => settings.selectedLevels.includes(s.level)),
        scenario.initialReviewStores![direction],
        settings
      );
    };
    expect(counts().sentences).toBe(
      sessionSize(session('pl-to-en')) + sessionSize(session('en-to-pl'))
    );
  });

  test('conjugation: every drillable form of every verb counts, both directions added', () => {
    const verbs = [verb('robić'), verb('mieć', { present: ['1sg'], past: ['1sg_m'] })];
    const { counts } = renderCounts({
      conjugation: {
        initialVerbs: verbs,
        initialReviewStores: {
          'pl-to-en': conjugationStore(
            { [formKey('robić', '1sg')]: dueCard(), [formKey('robić', '3sg')]: notDueCard() },
            { newFormsToday: [formKey('robić', '3sg')] }
          ),
          'en-to-pl': conjugationStore(),
        },
        initialSettings: { 'pl-to-en': { newCardsPerDay: 2 }, 'en-to-pl': { newCardsPerDay: 10 } },
      },
    });

    // pl-to-en: 1 due form + 1 of 2 new forms (one of two allowed is used); en-to-pl: all 4 forms.
    expect(counts().conjugation).toBe(2 + 4);
  });

  test('declension: due cards plus new cards up to the allowance', () => {
    const { counts } = renderCounts({
      declension: {
        initialSystemCards: [1, 2, 3, 4].map((id) => declensionCard(id)),
        initialReviewStore: declensionStore({ 1: dueCard(), 4: notDueCard() }),
        initialSettings: { newCardsPerDay: 1 },
      },
    });

    expect(counts().declension).toBe(2);
  });

  test('aspect pairs: each loaded pair counts once, whichever verb lists the other', () => {
    const verbs = [
      verb('robić', { aspectPair: 'zrobić' }),
      verb('zrobić', { aspectPair: 'robić' }),
      verb('pisać', { aspectPair: 'napisać' }),
      verb('napisać'),
      verb('mieć'),
      verb('iść', { aspectPair: 'not-loaded' }),
    ];
    const { h, counts } = renderCounts({
      aspectPairs: {
        verbs,
        initialReviewStore: aspectPairsStore({ robić: dueCard() }),
        initialSettings: { newCardsPerDay: 5 },
      },
    });

    expect(h.data().aspectPairCards.map((c) => [c.verb.id, c.pairVerb.id])).toEqual([
      ['robić', 'zrobić'],
      ['pisać', 'napisać'],
    ]);
    expect(counts().aspectPairs).toBe(2);
    expect(counts().aspectPairs).toBe(
      sessionSize(
        getAspectPairsSessionCards(h.data().aspectPairCards, h.data().aspectPairsReviewStore, {
          newCardsPerDay: 5,
        })
      )
    );
  });

  test('a saved rating lowers the count at once', async () => {
    const { h, counts } = renderCounts({
      vocabulary: {
        initialSystemWords: [word('w1'), word('w2'), word('w3')],
        initialSettings: { 'pl-to-en': { newCardsPerDay: 10 }, 'en-to-pl': { newCardsPerDay: 0 } },
      },
    });
    expect(counts().vocabulary).toBe(3);

    await h.run(() =>
      h
        .data()
        .updateVocabularyReviewStore(
          'pl-to-en',
          withWordRated(h.data().vocabularyReviewStores['pl-to-en'], 'w1')
        )
    );

    expect(counts().vocabulary).toBe(2);
  });

  test('custom items count alongside the built-in ones', () => {
    const custom = (id: string) => ({ id, isCustom: true as const, createdAt: 1 });
    const { counts } = renderCounts({
      vocabulary: {
        initialCustomWords: [{ ...word('c1'), ...custom('c1') }],
        initialSystemWords: [word('w1')],
        initialSettings: { 'pl-to-en': { newCardsPerDay: 10 }, 'en-to-pl': { newCardsPerDay: 0 } },
      },
      sentences: {
        initialCustomSentences: [{ ...sentence('c1'), ...custom('c1') }],
        initialSystemSentences: [sentence('s1')],
        initialSettings: {
          'pl-to-en': { newCardsPerDay: 10, selectedLevels: ['A1'] },
          'en-to-pl': { newCardsPerDay: 0, selectedLevels: ['A1'] },
        },
      },
      declension: {
        initialCustomCards: [{ ...declensionCard('c1'), ...custom('c1') }],
        initialSystemCards: [declensionCard(1)],
        initialSettings: { newCardsPerDay: 10 },
      },
    });

    expect(counts()).toMatchObject({ vocabulary: 2, sentences: 2, declension: 2 });
  });

  test('passes the loading flag through', () => {
    const { h } = renderCounts({ loading: true });
    expect(h.data().loading).toBe(true);

    h.provide({ loading: false });
    expect(h.data().loading).toBe(false);
  });
});

const LATE_EVENING = '2026-11-26T23:50:00-05:00';
const AFTER_MIDNIGHT = '2026-11-27T00:10:00-05:00';

/**
 * Sets the clock to 23:50 and returns what the providers hold then.
 * Vocabulary, pl-to-en: w1 introduced and still in learning, w2 introduced and
 * graduated, both done for the day; w3 and w4 unseen, and the allowance of 2 new
 * words is used up. Declension: card 1 graduated, falling due at 00:05.
 */
function lateEvening(): InitialData {
  setTime(LATE_EVENING);
  return {
    vocabulary: {
      initialSystemWords: ['w1', 'w2', 'w3', 'w4'].map((id) => word(id)),
      initialReviewStores: {
        'pl-to-en': vocabularyStore(
          { w1: fsrsCard(State.Learning, new Date(Date.now() + 10 * 60_000)), w2: notDueCard() },
          { reviewedToday: ['w1', 'w2'], newCardsToday: ['w1', 'w2'] }
        ),
        'en-to-pl': vocabularyStore(),
      },
      initialSettings: { 'pl-to-en': { newCardsPerDay: 2 }, 'en-to-pl': { newCardsPerDay: 0 } },
    },
    declension: {
      initialSystemCards: [declensionCard(1)],
      initialReviewStore: declensionStore({
        1: fsrsCard(State.Review, new Date(Date.now() + 15 * 60_000)),
      }),
      initialSettings: { newCardsPerDay: 0 },
    },
  };
}

describe('the app left open past midnight', () => {
  test('before midnight, the day’s lists hold the done cards and the used-up allowance back', () => {
    const { counts } = renderCounts(lateEvening());

    expect(counts()).toMatchObject({ vocabulary: 0, declension: 0 });
  });

  test('after midnight, a re-render recounts: a card that has fallen due since is counted', () => {
    const { h, counts } = renderCounts(lateEvening());

    setTime(AFTER_MIDNIGHT);
    h.rerender();

    expect(counts().declension).toBe(1);
  });

  test('a store whose new day has started (by a reload or a rating) offers the learning word and two new words', () => {
    const initial = lateEvening();
    setTime(AFTER_MIDNIGHT);
    const stores = initial.vocabulary!.initialReviewStores!;
    // loadDailyReviewSession and recordCardReview both start the day this way.
    const restarted = startDayIfNeeded(
      stores['pl-to-en'],
      ['reviewedToday', 'newCardsToday'],
      getTodayString()
    );

    const { counts } = renderCounts({
      vocabulary: {
        ...initial.vocabulary,
        initialReviewStores: { ...stores, 'pl-to-en': restarted },
      },
    });

    expect(counts().vocabulary).toBe(1 + 2);
  });

  test('after midnight, the counts start a new day', () => {
    const { h, counts } = renderCounts(lateEvening());

    setTime(AFTER_MIDNIGHT);
    // Any re-render of the providers (a save, a settings change, a custom-item
    // snapshot) recomputes the counts, as the test above shows.
    h.rerender();

    expect(counts().vocabulary).toBe(1 + 2);
  });

  test('with nothing else happening, the counts start a new day at midnight', () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { counts } = renderCounts(lateEvening());
    expect(counts().vocabulary).toBe(0);

    act(() => vi.advanceTimersByTime(20 * 60_000));

    expect(counts().vocabulary).toBe(1 + 2);
  });
});

describe('counts and the learner’s session filters', () => {
  /**
   * Signed in with `filters` saved for the learner, and the app's
   * UserFiltersProvider wrapped around the review providers, so a counts provider
   * that honoured the filters could read them either way.
   */
  async function renderWithSavedFilters(initial: InitialData, filters: Partial<UserFilters>) {
    const uid = freshUid();
    seedUserDoc(uid, 'userFilters', { ...DEFAULT_USER_FILTERS, ...filters });
    const h = renderReviewProviders(uid, initial, { userFilters: true });
    await act(idle);
    return h;
  }

  const declensionScenario = () => {
    const cards = [
      declensionCard(1, { case: 'Genitive' }),
      declensionCard(2, { case: 'Dative' }),
      declensionCard(3, { case: 'Locative' }),
      declensionCard(4, { case: 'Dative' }),
    ];
    const store = declensionStore({ 4: dueCard() });
    const settings = { newCardsPerDay: 10 };
    return {
      initial: {
        declension: {
          initialSystemCards: cards,
          initialReviewStore: store,
          initialSettings: settings,
        },
      },
      /** What the declension page would serve with these filters. */
      session: (filters: DeclensionFilters) =>
        sessionSize(getDeclensionSessionCards(cards, store, filters, settings)),
    };
  };
  const GENITIVE_ONLY: DeclensionFilters = { cases: ['Genitive'], genders: [], number: 'All' };

  const conjugationScenario = () => {
    const verbs = [verb('robić', { present: ['1sg', '3sg'], past: ['1sg_m'] })];
    const stores = { 'pl-to-en': conjugationStore(), 'en-to-pl': conjugationStore() };
    const settings = { 'pl-to-en': { newCardsPerDay: 10 }, 'en-to-pl': { newCardsPerDay: 10 } };
    return {
      initial: {
        conjugation: {
          initialVerbs: verbs,
          initialReviewStores: stores,
          initialSettings: settings,
        },
      },
      /** What the conjugation page would serve with these filters, both directions added. */
      session: (filters: ConjugationFilters) =>
        (['pl-to-en', 'en-to-pl'] as const).reduce(
          (sum, d) =>
            sum + sessionSize(getConjugationSessionCards(verbs, stores[d], filters, settings[d])),
          0
        ),
    };
  };
  const PAST_ONLY: ConjugationFilters = { ...DEFAULT_USER_FILTERS.conjugation, tenses: ['past'] };

  test('declension without filters: the badge matches the session', () => {
    const { initial, session } = declensionScenario();
    const { counts } = renderCounts(initial);
    expect(counts().declension).toBe(session(DEFAULT_USER_FILTERS.declension));
  });

  test('conjugation without filters: the badge matches the sessions', () => {
    const { initial, session } = conjugationScenario();
    const { counts } = renderCounts(initial);
    expect(counts().conjugation).toBe(session(DEFAULT_USER_FILTERS.conjugation));
  });

  // Guards the two tests below: their filters are really loaded, and they really
  // shrink the sessions.
  test('the saved filters are loaded next to the counts and narrow the sessions', async () => {
    const declension = declensionScenario();
    const conjugation = conjugationScenario();
    const h = await renderWithSavedFilters(
      { ...declension.initial, ...conjugation.initial },
      { declension: GENITIVE_ONLY, conjugation: PAST_ONLY }
    );

    expect(h.filters()).toEqual({ declension: GENITIVE_ONLY, conjugation: PAST_ONLY });
    expect(declension.session(GENITIVE_ONLY)).toBe(1 + 1);
    expect(conjugation.session(PAST_ONLY)).toBe(1 + 1);
  });

  test('declension filtered to one case: the badge matches the session', async () => {
    const { initial, session } = declensionScenario();
    const h = await renderWithSavedFilters(initial, { declension: GENITIVE_ONLY });

    expect(h.data().counts.declension).toBe(session(GENITIVE_ONLY));
  });

  test('conjugation filtered to one tense: the badge matches the sessions', async () => {
    const { initial, session } = conjugationScenario();
    const h = await renderWithSavedFilters(initial, { conjugation: PAST_ONLY });

    expect(h.data().counts.conjugation).toBe(session(PAST_ONLY));
  });
});
