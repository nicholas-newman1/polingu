import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyCard, State } from 'ts-fsrs';
import getDeclensionSessionCards from '../src/lib/declensionScheduler/getSessionCards.ts';
import getConjugationSessionCards from '../src/lib/conjugationScheduler/getConjugationSessionCards.ts';
import { DEFAULT_USER_FILTERS } from '../src/types/userFilters.ts';

const settings = { newCardsPerDay: 5 };
const dueCard = { ...createEmptyCard(), state: State.Review, due: new Date(0) };
const dailyCounts = [
  [0, 5],
  [4, 1],
  [5, 0],
  [10, 0],
];

test('declension caps new cards and keeps due reviews when the daily allowance is exhausted', () => {
  // With 10 already introduced, this leaves 13 due reviews and 282 unseen cards.
  const deck = Array.from({ length: 305 }, (_, id) => ({ id, isCustom: id >= 268 }));
  const due = Array.from({ length: 13 }, (_, cardId) => [cardId, { cardId, fsrsCard: dueCard }]);
  for (const [used, expected] of dailyCounts) {
    const newCardsToday = deck.slice(13, 13 + used).map((card) => card.id);
    const session = getDeclensionSessionCards(
      deck,
      { cards: Object.fromEntries(due), reviewedToday: newCardsToday, newCardsToday },
      DEFAULT_USER_FILTERS.declension,
      settings
    );
    assert.equal(session.reviewCards.length, 13);
    assert.equal(session.newCards.length, expected);
    assert.ok(session.newCards.every(({ card }) => card.isCustom));
  }
});

test('conjugation caps new forms and keeps due reviews when the daily allowance is exhausted', () => {
  const verbs = Array.from({ length: 24 }, (_, i) => ({
    id: String(i),
    conjugations: { present: { '1sg': { pl: 'robię', en: ['I do'] } } },
  }));
  const keys = verbs.map(({ id }) => id + ':present:1sg');
  const forms = { [keys[0]]: { formKey: keys[0], fsrsCard: dueCard } };
  for (const [used, expected] of dailyCounts) {
    const newFormsToday = keys.slice(1, 1 + used);
    const session = getConjugationSessionCards(
      verbs,
      { forms, reviewedToday: newFormsToday, newFormsToday },
      DEFAULT_USER_FILTERS.conjugation,
      settings
    );
    assert.equal(session.reviewCards.length, 1);
    assert.equal(session.newCards.length, expected);
  }
});
