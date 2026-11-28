/**
 * Behaviour every module's scheduler shares: which cards make today's session,
 * the daily new-card allowance, review order, review early and extra new cards.
 * Module-specific behaviour (filters, shuffling) lives in the per-module files.
 */
import { beforeEach, describe, expect, test } from 'vitest';
import {
  MODULES,
  customFirst,
  freezeTime,
  graduated,
  inMinutes,
  learning,
  relearning,
  State,
  type Item,
} from './fixtures';
import { fsrsCard } from '../helpers/fsrs';

beforeEach(() => freezeTime());

const sorted = (ids: string[]) => [...ids].sort();

describe.each(MODULES)('$name scheduler', (module) => {
  test('sorts each card into new, review or neither by its state and what happened today', () => {
    const items: Item[] = [
      { id: 'never-seen' },
      { id: 'learning-step-due-later', card: learning(10) },
      { id: 'relearning-after-lapse', card: relearning(10) },
      { id: 'overdue', card: graduated(-3) },
      { id: 'due-this-instant', card: fsrsCard(State.Review, new Date()) },
      // Rated Again earlier today and the app was closed: it must come back.
      { id: 'again-before-reload', card: learning(1), introducedToday: true },
      { id: 'due-in-a-minute', card: fsrsCard(State.Review, inMinutes(1)) },
      { id: 'not-due-for-days', card: graduated(4) },
      { id: 'learning-finished-today', card: learning(10), reviewedToday: true },
      { id: 'overdue-but-reviewed-on-other-device', card: graduated(-1), reviewedToday: true },
      { id: 'unseen-but-counted-today', introducedToday: true },
    ];

    const session = module.session(items, 20);

    expect(session.new).toEqual(['never-seen']);
    expect(sorted(session.review)).toEqual(
      sorted([
        'learning-step-due-later',
        'relearning-after-lapse',
        'overdue',
        'due-this-instant',
        'again-before-reload',
      ])
    );
  });

  test.each([
    // [daily limit, new cards already introduced today, new cards offered now]
    [5, 0, 5],
    [5, 3, 2],
    [5, 5, 0],
    // The limit was lowered after the learner had already studied more.
    [5, 8, 0],
    [0, 0, 0],
  ])(
    'with a limit of %i and %i introduced today, offers %i new cards and keeps every due review',
    (limit, introduced, expected) => {
      const items: Item[] = [
        ...Array.from({ length: 4 }, (_, i) => ({ id: `due-${i}`, card: graduated(-1) })),
        ...Array.from({ length: introduced }, (_, i) => ({
          id: `introduced-${i}`,
          card: learning(10),
          introducedToday: true,
          reviewedToday: true,
        })),
        ...Array.from({ length: 12 }, (_, i) => ({ id: `unseen-${i}` })),
      ];

      const session = module.session(items, limit);

      expect(sorted(session.review)).toEqual(['due-0', 'due-1', 'due-2', 'due-3']);
      expect(session.new).toHaveLength(expected);
      expect(session.new.every((id) => id.startsWith('unseen-'))).toBe(true);
      expect(new Set(session.new).size).toBe(expected);
    }
  );

  test('an empty deck gives an empty session and nothing extra', () => {
    expect(module.session([], 10)).toEqual({ review: [], new: [] });
    expect(module.practiceAhead([], 10)).toEqual([]);
    expect(module.extraNew([], 10)).toEqual([]);
  });

  test('a deck with nothing due and nothing new gives an empty session', () => {
    const items: Item[] = [
      { id: 'a', card: graduated(3) },
      { id: 'b', card: learning(10), reviewedToday: true },
    ];
    expect(module.session(items, 10)).toEqual({ review: [], new: [] });
  });

  test('extra new cards skip cards already introduced today and stop at the requested count', () => {
    const items: Item[] = [
      { id: 'studied', card: graduated(2) },
      { id: 'counted-today', introducedToday: true },
      { id: 'learning', card: learning(10), introducedToday: true },
      ...Array.from({ length: 6 }, (_, i) => ({ id: `unseen-${i}` })),
    ];

    const extra = module.extraNew(items, 4);

    expect(extra).toHaveLength(4);
    expect(new Set(extra).size).toBe(4);
    expect(extra.every((id) => id.startsWith('unseen-'))).toBe(true);
    expect(module.extraNew(items, 50)).toHaveLength(6);
  });

  test('review early stops at the requested count, soonest-due first', () => {
    const items: Item[] = [
      { id: 'in-9-days', card: graduated(9) },
      { id: 'in-2-days', card: graduated(2) },
      { id: 'in-5-days', card: graduated(5) },
      { id: 'in-1-day', card: graduated(1) },
    ];
    expect(module.practiceAhead(items, 3)).toEqual(['in-1-day', 'in-2-days', 'in-5-days']);
  });

  test('review early leaves out unseen, learning and relearning cards and those reviewed today', () => {
    const items: Item[] = [
      { id: 'unseen' },
      { id: 'learning', card: learning(10) },
      { id: 'relearning', card: relearning(10) },
      { id: 'reviewed-today', card: graduated(3), reviewedToday: true },
      { id: 'eligible', card: graduated(3) },
    ];
    expect(module.practiceAhead(items, 10)).toEqual(['eligible']);
  });
});

describe.each(MODULES)('$name review early', (module) => {
  test('does not offer a card that is already due, which belongs in the normal session', () => {
    const items: Item[] = [
      { id: 'overdue', card: graduated(-2) },
      { id: 'due-now', card: fsrsCard(State.Review, new Date()) },
      { id: 'tomorrow', card: graduated(1) },
    ];
    expect(module.practiceAhead(items, 10)).toEqual(['tomorrow']);
  });
});

describe.each(MODULES.filter((m) => !m.hasCustomCards))('$name review order', (module) => {
  test('reviews are ordered by due date, most overdue first', () => {
    const items: Item[] = [
      { id: 'learning-in-10-min', card: learning(10) },
      { id: 'overdue-1-day', card: graduated(-1) },
      { id: 'overdue-6-days', card: graduated(-6) },
      { id: 'overdue-3-days', card: graduated(-3) },
    ];
    expect(module.session(items, 10).review).toEqual([
      'overdue-6-days',
      'overdue-3-days',
      'overdue-1-day',
      'learning-in-10-min',
    ]);
  });
});

describe.each(MODULES.filter((m) => m.hasCustomCards))('$name custom cards', (module) => {
  test('custom reviews come before built-in ones, each group ordered by due date', () => {
    const items: Item[] = [
      { id: 'system-overdue-9', card: graduated(-9) },
      { id: 'custom-overdue-1', custom: true, card: graduated(-1) },
      { id: 'system-learning', card: learning(10) },
      { id: 'custom-overdue-4', custom: true, card: graduated(-4) },
      { id: 'system-overdue-2', card: graduated(-2) },
    ];
    expect(module.session(items, 10).review).toEqual([
      'custom-overdue-4',
      'custom-overdue-1',
      'system-overdue-9',
      'system-overdue-2',
      'system-learning',
    ]);
  });

  test('custom new cards are introduced before built-in ones', () => {
    const items: Item[] = [
      { id: 'system-1' },
      { id: 'custom-1', custom: true },
      { id: 'system-2' },
      { id: 'custom-2', custom: true },
    ];
    const session = module.session(items, 10);
    expect(sorted(session.new)).toEqual(['custom-1', 'custom-2', 'system-1', 'system-2']);
    expect(customFirst(session.new, items)).toBe(true);
  });

  test('when the allowance is tight, custom cards win the places whatever order the deck is in', () => {
    const items: Item[] = [
      { id: 'system-1' },
      { id: 'custom-1', custom: true },
      { id: 'system-2' },
      { id: 'custom-2', custom: true },
      { id: 'system-3' },
    ];
    const session = module.session(items, 3);
    expect(session.new).toHaveLength(3);
    expect(session.new.slice(0, 2).sort()).toEqual(['custom-1', 'custom-2']);
  });

  test('extra new cards put custom cards first whatever order the deck is in', () => {
    const items: Item[] = [
      { id: 'system-1' },
      { id: 'custom-1', custom: true },
      { id: 'system-2' },
      { id: 'custom-2', custom: true },
    ];
    const extra = module.extraNew(items, 3);
    expect(extra).toHaveLength(3);
    expect(extra.slice(0, 2).sort()).toEqual(['custom-1', 'custom-2']);
  });
});

describe.each(MODULES.filter((m) => m.hasCustomCards))(
  '$name extra new cards with custom cards',
  (module) => {
    test('list custom cards before built-in ones whatever order the deck is in', () => {
      const items: Item[] = [
        { id: 'system-1' },
        { id: 'custom-1', custom: true },
        { id: 'system-2' },
        { id: 'custom-2', custom: true },
      ];
      const extra = module.extraNew(items, 10);
      expect(sorted(extra)).toEqual(['custom-1', 'custom-2', 'system-1', 'system-2']);
      expect(customFirst(extra, items)).toBe(true);
    });
  }
);

describe.each(MODULES)('$name scheduler and the learner’s data', (module) => {
  test('building a session, review early and extra new cards never write to the store or deck', () => {
    // The adapters freeze the store and deck they pass in, so any write throws.
    const items: Item[] = [
      { id: 'unseen-1' },
      { id: 'unseen-2' },
      { id: 'counted-today', introducedToday: true },
      { id: 'overdue', card: graduated(-2) },
      { id: 'learning', card: learning(10), introducedToday: true },
      { id: 'later', card: graduated(3) },
      { id: 'done-today', card: graduated(-1), reviewedToday: true },
    ];
    expect(() => module.session(items, 1)).not.toThrow();
    expect(() => module.practiceAhead(items, 5)).not.toThrow();
    expect(() => module.extraNew(items, 5)).not.toThrow();
    expect(module.session(items, 1).review).toHaveLength(2);
  });
});

describe.each(MODULES.filter((m) => m.hasCustomCards))(
  '$name review early with custom cards',
  (module) => {
    test('offers custom cards before built-in ones, each group soonest-due first', () => {
      const items: Item[] = [
        { id: 'system-in-1-day', card: graduated(1) },
        { id: 'custom-in-8-days', custom: true, card: graduated(8) },
        { id: 'system-in-3-days', card: graduated(3) },
        { id: 'custom-in-2-days', custom: true, card: graduated(2) },
      ];
      expect(module.practiceAhead(items, 3)).toEqual([
        'custom-in-2-days',
        'custom-in-8-days',
        'system-in-1-day',
      ]);
    });
  }
);
