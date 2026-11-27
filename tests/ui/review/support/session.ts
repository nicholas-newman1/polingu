/**
 * What a learner sees and does on a review page, as queries and actions.
 */
import {
  fireEvent,
  screen,
  within,
  type BoundFunctions,
  type queries,
} from '@testing-library/react';
import { expect } from 'vitest';
import { click, elapse } from './app';

type Page = BoundFunctions<typeof queries>;
export type Rating = 'Again' | 'Hard' | 'Good' | 'Easy';

const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

export function reviewSession(page: Page) {
  const ratingButton = (rating: Rating) =>
    page.getByRole('button', { name: new RegExp(`^${rating}\\b`) });

  return {
    reveal: () => click(page.getByRole('button', { name: 'Reveal Answer' })),

    /** Rates the card on screen and lets it finish leaving (and the rating save). */
    rate: async (rating: Rating) => {
      click(ratingButton(rating));
      await elapse();
    },

    /** The interval each rating button shows, e.g. { Again: '1m', ... }. */
    intervals: () =>
      Object.fromEntries(
        (['Again', 'Hard', 'Good', 'Easy'] as const).map((rating) => [
          rating,
          normalize(ratingButton(rating).textContent).slice(rating.length),
        ])
      ),

    hasRatingButtons: () => page.queryByRole('button', { name: /^Good\b/ }) !== null,

    /** The line above the card, e.g. "1 reviews · 2 new · 3 remaining". */
    status: () =>
      normalize(
        page.getByText(
          (_, el) =>
            el?.tagName === 'P' && /remaining|Drill Mode/.test(el.textContent ?? '') === true
        ).textContent
      ),

    goBack: () => click(page.getByRole('button', { name: 'Previous Card' })),

    continue: async () => {
      click(page.getByRole('button', { name: 'Continue →' }));
      await elapse();
    },

    nextDrillCard: async () => {
      click(page.getByRole('button', { name: 'Next Card →' }));
      await elapse();
    },

    toggleDrill: () => click(page.getByRole('button', { name: /Drill$/ })),

    openSettings: () => click(page.getByRole('button', { name: 'Settings' })),

    /** Types into the "New cards per day" box and leaves it, as the learner would. */
    setNewCardsPerDay: (value: string) => {
      const input = page.getByRole('spinbutton');
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    },
  };
}

/** The finished-session card. */
export function finishedState(page: Page) {
  /** "Learn new" and "Review early" rows: a count with -/+ steppers and a start button. */
  const row = (title: 'Learn new' | 'Review early') => {
    const box = page.getByText(title).parentElement?.parentElement;
    if (!box) throw new Error(`No "${title}" row`);
    const [decrease, increase, start] = within(box).getAllByRole('button');
    return { count: within(box).getByRole('textbox'), decrease, increase, start };
  };

  return {
    heading: () => page.getByRole('heading', { name: /What's next\?|All done!/ }).textContent,
    /** The recap's figures, e.g. ['5 reviews', '80% recall', 'Easy 1', ...]. */
    recap: () => {
      const box = page.getByText(/recall$/).parentElement?.parentElement;
      return [...(box?.querySelectorAll('.MuiTypography-root') ?? [])].map((el) =>
        normalize(el.textContent)
      );
    },
    learnNew: () => row('Learn new'),
    reviewEarly: () => row('Review early'),
  };
}

/** Deck stats on a mode-selector or dashboard card: due badge, learned and total. */
export function deckStats(card: HTMLElement) {
  const text = normalize(card.textContent).replace(/\s/g, '');
  const match = /^(\d*).*?(\d+)Learned\/(\d+)Total$/.exec(text);
  expect(match, `stats in "${text}"`).not.toBeNull();
  const [, due, learned, total] = match!;
  return { due: Number(due || 0), learned: Number(learned), total: Number(total) };
}

/**
 * The innermost element whose whole text is `text`, for sentences the app splits
 * into one tappable element per word.
 */
export function sentenceText(page: Page, text: string) {
  return page.getByText((_, el) => {
    if (!el || normalize(el.textContent) !== text) return false;
    return ![...el.children].some((child) => normalize(child.textContent) === text);
  });
}

/**
 * A filter dropdown, found through its visible label: the dropdowns have no
 * accessible name of their own (see the test.fails in declension.test.tsx).
 */
export function filterDropdown(page: Page, label: string) {
  const control = page.getByText(label, { selector: 'label' }).parentElement;
  if (!control) throw new Error(`No "${label}" filter`);
  return within(control).getByRole('combobox');
}

/** Picks options in one of the filter dropdowns, then closes it. */
export async function chooseFilter(page: Page, label: string, ...options: string[]) {
  fireEvent.mouseDown(filterDropdown(page, label));
  const listbox = within(screen.getByRole('listbox'));
  for (const option of options) click(listbox.getByRole('option', { name: option }));
  // A multiple-choice dropdown stays open; a single-choice one closes by itself.
  const open = screen.queryByRole('listbox');
  if (open) fireEvent.keyDown(open, { key: 'Escape' });
  await elapse();
}

/** The removable chip showing an active filter value. */
export const filterChip = (page: Page, label: string) =>
  page.getByRole('button', { name: `Remove ${label} filter` });
