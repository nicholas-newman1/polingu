export interface ReviewOutcome {
  /** The card was new when rated, so it counts toward today's new-card limit. */
  isNew: boolean;
  /** The card left the session (any rating other than Again). */
  completed: boolean;
}

function appendUnique<Id extends string | number>(ids: Id[], id: Id): Id[] {
  const idStr = String(id);
  return ids.some((existing) => String(existing) === idStr) ? ids : [...ids, id];
}

export function recordCardReview<
  Id extends string | number,
  R,
  Store extends { cards: { [key: string]: R }; reviewedToday: Id[]; newCardsToday: Id[] },
>(store: Store, id: Id, reviewData: R, outcome: ReviewOutcome): Store {
  return {
    ...store,
    cards: { ...store.cards, [id]: reviewData },
    newCardsToday: outcome.isNew ? appendUnique(store.newCardsToday, id) : store.newCardsToday,
    reviewedToday: outcome.completed ? appendUnique(store.reviewedToday, id) : store.reviewedToday,
  };
}

export function recordFormReview<
  R,
  Store extends { forms: { [key: string]: R }; reviewedToday: string[]; newFormsToday: string[] },
>(store: Store, formKey: string, reviewData: R, outcome: ReviewOutcome): Store {
  return {
    ...store,
    forms: { ...store.forms, [formKey]: reviewData },
    newFormsToday: outcome.isNew ? appendUnique(store.newFormsToday, formKey) : store.newFormsToday,
    reviewedToday: outcome.completed
      ? appendUnique(store.reviewedToday, formKey)
      : store.reviewedToday,
  };
}
