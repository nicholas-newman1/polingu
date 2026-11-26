import { createEmptyCard, State, type Card } from 'ts-fsrs';

export { State };

export const DAY = 864e5;

/** A date `days` from now (negative for the past). Respects vi.setSystemTime. */
export const inDays = (days: number) => new Date(Date.now() + days * DAY);

/**
 * An FSRS card in the given state, due at `due`. Cards past New get a plausible
 * memory state (last reviewed 10 days before `due`): ts-fsrs returns NaN due
 * dates when rating a studied card whose stability is 0.
 */
export const fsrsCard = (state: State, due: Date, overrides: Partial<Card> = {}): Card => ({
  ...createEmptyCard(),
  ...(state === State.New
    ? {}
    : {
        stability: 10,
        difficulty: 5,
        reps: 3,
        scheduled_days: 10,
        last_review: new Date(due.getTime() - 10 * DAY),
      }),
  state,
  due,
  ...overrides,
});
