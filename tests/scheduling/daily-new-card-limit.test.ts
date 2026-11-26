import { expect, test } from 'vitest';
import getDeclensionSessionCards from '../../src/lib/declensionScheduler/getSessionCards';
import getConjugationSessionCards from '../../src/lib/conjugationScheduler/getConjugationSessionCards';
import { DEFAULT_USER_FILTERS } from '../../src/types/userFilters';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import type { ConjugationReviewDataStore, Verb } from '../../src/types/conjugation';
import { fsrsCard, State } from '../helpers/fsrs';
import { stub, stubs } from '../helpers/stub';

const settings = { newCardsPerDay: 5 };
const dueCard = fsrsCard(State.Review, new Date(0));
// [new cards already introduced today, new cards expected in the session]
const dailyCounts = [
  [0, 5],
  [4, 1],
  [5, 0],
  [10, 0],
] as const;

test('declension caps new cards and keeps due reviews when the daily allowance is exhausted', () => {
  // With 10 already introduced, this leaves 13 due reviews and 282 unseen cards.
  const deck = stubs<DeclensionCard>(
    Array.from({ length: 305 }, (_, id) => ({ id, isCustom: id >= 268 }))
  );
  const due = Array.from({ length: 13 }, (_, cardId) => [cardId, { cardId, fsrsCard: dueCard }]);
  for (const [used, expected] of dailyCounts) {
    const newCardsToday = deck.slice(13, 13 + used).map((card) => card.id);
    const session = getDeclensionSessionCards(
      deck,
      stub<DeclensionReviewDataStore>({
        cards: Object.fromEntries(due),
        reviewedToday: newCardsToday,
        newCardsToday,
      }),
      DEFAULT_USER_FILTERS.declension,
      settings
    );
    expect(session.reviewCards).toHaveLength(13);
    expect(session.newCards).toHaveLength(expected);
    expect(session.newCards.every(({ card }) => card.isCustom)).toBe(true);
  }
});

test('conjugation caps new forms and keeps due reviews when the daily allowance is exhausted', () => {
  const verbs = stubs<Verb>(
    Array.from({ length: 24 }, (_, i) => ({
      id: String(i),
      conjugations: {
        present: stub<NonNullable<Verb['conjugations']['present']>>({
          '1sg': { pl: 'robię', en: ['I do'] },
        }),
      },
    }))
  );
  const keys = verbs.map(({ id }) => id + ':present:1sg');
  const forms = { [keys[0]]: { formKey: keys[0], fsrsCard: dueCard } };
  for (const [used, expected] of dailyCounts) {
    const newFormsToday = keys.slice(1, 1 + used);
    const session = getConjugationSessionCards(
      verbs,
      stub<ConjugationReviewDataStore>({ forms, reviewedToday: newFormsToday, newFormsToday }),
      DEFAULT_USER_FILTERS.conjugation,
      settings
    );
    expect(session.reviewCards).toHaveLength(1);
    expect(session.newCards).toHaveLength(expected);
  }
});
