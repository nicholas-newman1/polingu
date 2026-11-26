/**
 * What every review context does with its review store and settings: show a
 * change at once, save exactly that change, keep it (and report) when the save
 * fails, and reset only after storage has been reset.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act } from '@testing-library/react';
import { remote } from '../sync/support/fakeFirestore';
import { freezeTime, network, setupSyncTests, userPath } from '../sync/support/harness';
import { syncAllPendingReviewCards } from '../../src/lib/storage/reviewStorageRegistry';
import { syncAllPendingToFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import { getTodayString } from '../../src/lib/storage/helpers';
import type { TranslationDirection } from '../../src/types/common';
import { renderReviewProviders, SAVE_ERROR } from './support/render';
import {
  ALL_FEATURES,
  aspectPairs,
  conjugation,
  declension,
  sentences,
  vocabulary,
  type CardsByDirection,
  type Feature,
} from './support/features';
import {
  cardDeletes,
  cardWrites,
  freshUid,
  ratedNow,
  serverDoc,
  serverIds,
} from './support/fixtures';
import { seedServerCard } from './support/server';

vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));

setupSyncTests();

const PL: TranslationDirection = 'pl-to-en';
const EN: TranslationDirection = 'en-to-pl';
const NOW = '2026-11-26T19:00:00-05:00';

// Fixtures date their cards from now, so the clock is frozen before any is made.
beforeEach(() => freezeTime(NOW));

/** Signed in, with `cards` in the shown stores and on the server. */
function setup(feature: Feature, cards: CardsByDirection = {}) {
  const uid = freshUid();
  // A feature reviewed one way only keeps a single store: the pl-to-en one here.
  for (const direction of feature.directional ? [PL, EN] : [PL]) {
    for (const [id, card] of Object.entries(cards[direction] ?? {})) {
      seedServerCard(uid, feature.collection(direction), feature.idField, id, card);
    }
  }
  const h = renderReviewProviders(uid, feature.initial(cards));
  const store = (direction = PL) => feature.shownStore(h.data(), direction);
  const settings = (direction = PL) => feature.shownSettings(h.data(), direction);
  return { h, uid, store, settings, f: feature };
}

/** a and b reviewed in pl-to-en, x in en-to-pl. */
const withOtherDirection = (): CardsByDirection => ({
  'pl-to-en': { a: ratedNow(), b: ratedNow() },
  'en-to-pl': { x: ratedNow() },
});

describe.each(ALL_FEATURES.map((feature) => [feature.name, feature] as const))(
  '%s',
  (_name, feature) => {
    describe('saving a review store', () => {
      test('shows the new store at once and writes only the changed card and today’s lists', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());
        const otherBefore = store(EN);
        const next = f.rate(store(), 'c');

        const serverWrite = remote.hold('setDoc');
        let saving!: Promise<void>;
        act(() => {
          saving = f.update(h.data(), PL, next);
        });
        expect(store()).toBe(next);
        serverWrite.release();
        await act(() => saving);

        expect(cardWrites(uid, f.collection(PL))).toEqual(['c']);
        expect(serverIds(uid, f.collection(PL))).toEqual(['a', 'b', 'c']);
        expect(serverDoc(uid, f.sessionDoc(PL))).toMatchObject({
          reviewedToday: ['c'],
          [f.newList]: ['c'],
          lastReviewDate: getTodayString(),
        });
        expect(h.errors()).toEqual([]);
        if (f.directional) {
          expect(store(EN)).toBe(otherBefore);
          expect(cardWrites(uid, f.collection(EN))).toEqual([]);
        }
      });

      test('back-to-back saves each write only their own change', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());
        const first = f.rate(store(), 'c');
        const second = f.rate(first, 'd');

        await h.run(async () => {
          const saves = [f.update(h.data(), PL, first), f.update(h.data(), PL, second)];
          await Promise.all(saves);
        });

        expect(cardWrites(uid, f.collection(PL))).toEqual(['c', 'd']);
        expect(store()).toBe(second);
        expect(serverDoc(uid, f.sessionDoc(PL))).toMatchObject({ [f.newList]: ['c', 'd'] });
      });

      test('deletes a card the new store no longer holds', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());

        await h.run(() => f.update(h.data(), PL, f.without(store(), 'a')));

        expect(cardDeletes(uid, f.collection(PL))).toEqual(['a']);
        expect(cardWrites(uid, f.collection(PL))).toEqual([]);
        expect(serverIds(uid, f.collection(PL))).toEqual(['b']);
        expect(f.cardIds(store())).toEqual(['b']);
      });

      test('a save the server rejects stays shown, is reported, and reaches the server on the next sync', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());
        const next = f.rate(store(), 'c');
        remote.fail({ op: 'setDoc', path: userPath(uid, f.collection(PL)) }, { times: 1 });

        await h.run(() => f.update(h.data(), PL, next));

        expect(h.errors()).toEqual([SAVE_ERROR]);
        expect(store()).toBe(next);
        expect(serverIds(uid, f.collection(PL))).toEqual(['a', 'b']);

        await syncAllPendingReviewCards();
        expect(serverIds(uid, f.collection(PL))).toEqual(['a', 'b', 'c']);
      });

      test('fresh data handed in by a sync replaces the shown store, and later saves are diffed against it', async () => {
        const { h, uid, store, f } = setup(feature, { 'pl-to-en': { a: ratedNow() } });

        h.provide(f.initial({ 'pl-to-en': { a: ratedNow(), b: ratedNow() } }));
        expect(f.cardIds(store())).toEqual(['a', 'b']);

        await h.run(() => f.update(h.data(), PL, f.rate(store(), 'c')));
        expect(cardWrites(uid, f.collection(PL))).toEqual(['c']);
        expect(cardDeletes(uid, f.collection(PL))).toEqual([]);

        // Signing out or switching accounts withdraws the data.
        h.provide({});
        expect(f.cardIds(store())).toEqual([]);
        expect(f.newIds(store())).toEqual([]);
      });

      test('signed out: the change is shown and nothing is written', async () => {
        const h = renderReviewProviders(null, feature.initial({ 'pl-to-en': { a: ratedNow() } }));
        const next = feature.rate(feature.shownStore(h.data(), PL), 'c');

        await h.run(() => feature.update(h.data(), PL, next));

        expect(feature.shownStore(h.data(), PL)).toBe(next);
        expect(remote.calls).toEqual([]);
        expect(h.errors()).toEqual([]);
      });
    });

    describe('settings', () => {
      test('new settings show at once and are saved, for that direction only', async () => {
        const { h, uid, settings, f } = setup(feature);
        const otherBefore = settings(EN);

        const serverWrite = remote.hold('setDoc');
        let saving!: Promise<void>;
        act(() => {
          saving = f.updateSettings(h.data(), PL, f.changedSettings);
        });
        expect(settings()).toEqual(f.changedSettings);
        serverWrite.release();
        await act(() => saving);

        expect(settings()).toEqual(f.changedSettings);
        expect(serverDoc(uid, f.settingsDoc(PL))).toEqual(f.changedSettings);
        if (f.directional) {
          expect(settings(EN)).toEqual(otherBefore);
          expect(serverDoc(uid, f.settingsDoc(EN))).toBeUndefined();
        }
        expect(await f.loadSettings(PL)).toEqual(f.changedSettings);
      });

      test('settings the server rejects stay shown and the failure is reported', async () => {
        const { h, uid, settings, f } = setup(feature);
        remote.fail({ op: 'setDoc', path: userPath(uid, 'data', f.settingsDoc(PL)) });

        await h.run(() => f.updateSettings(h.data(), PL, f.changedSettings));

        expect(settings()).toEqual(f.changedSettings);
        expect(h.errors()).toEqual([SAVE_ERROR]);
      });
    });

    describe('resetting progress', () => {
      test('deletes the progress on the server and shows an empty store, for that direction only', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());
        await h.run(() => f.update(h.data(), PL, f.rate(store(), 'c')));
        const otherBefore = store(EN);

        await h.run(() => f.clear(h.data(), PL));

        expect(serverIds(uid, f.collection(PL))).toEqual([]);
        expect(serverDoc(uid, f.sessionDoc(PL))).toBeUndefined();
        expect(f.cardIds(store())).toEqual([]);
        expect(f.newIds(store())).toEqual([]);
        expect(h.errors()).toEqual([]);
        if (f.directional) {
          expect(serverIds(uid, f.collection(EN))).toEqual(['x']);
          expect(store(EN)).toBe(otherBefore);
        }
      });

      test('a reset the server rejects keeps the progress and settings shown and is reported', async () => {
        const { h, uid, store, settings, f } = setup(feature, withOtherDirection());
        await h.run(() => f.updateSettings(h.data(), PL, f.changedSettings));
        const before = store();
        remote.fail({ op: 'getDocs', path: userPath(uid, f.collection(PL)) });

        await h.run(() => f.clear(h.data(), PL));

        expect(h.errors()).toEqual([SAVE_ERROR]);
        expect(store()).toBe(before);
        expect(settings()).toEqual(f.changedSettings);
        expect(serverIds(uid, f.collection(PL))).toEqual(['a', 'b']);
      });

      test('offline, the shown progress clears at once and the server follows once back online', async () => {
        const { h, uid, store, f } = setup(feature, withOtherDirection());
        await h.run(() => f.update(h.data(), PL, f.rate(store(), 'c')));
        network.goOffline();

        await h.run(() => f.clear(h.data(), PL));

        expect(h.errors()).toEqual([]);
        expect(f.cardIds(store())).toEqual([]);
        expect(serverIds(uid, f.collection(PL))).toEqual(['a', 'b', 'c']);

        network.goOnline();
        await syncAllPendingReviewCards();
        await syncAllPendingToFirestore();
        expect(serverIds(uid, f.collection(PL))).toEqual([]);
        expect(serverDoc(uid, f.sessionDoc(PL))).toBeUndefined();
      });
    });
  }
);

describe.each([vocabulary, sentences, conjugation].map((f) => [f.name, f] as const))(
  '%s, both directions at once',
  (_name, f) => {
    test('reviews saved to each direction in the same moment are both kept and both written', async () => {
      const { h, uid, store } = setup(f, withOtherDirection());
      const plNext = f.rate(store(PL), 'c');
      const enNext = f.rate(store(EN), 'y');

      await h.run(async () => {
        await Promise.all([f.update(h.data(), PL, plNext), f.update(h.data(), EN, enNext)]);
      });

      expect(store(PL)).toBe(plNext);
      expect(store(EN)).toBe(enNext);
      expect(cardWrites(uid, f.collection(PL))).toEqual(['c']);
      expect(cardWrites(uid, f.collection(EN))).toEqual(['y']);
    });

    test('settings changed for each direction in the same moment are both kept', async () => {
      const { h, settings } = setup(f);
      const enSettings = { ...(f.changedSettings as object), newCardsPerDay: 7 };

      await h.run(async () => {
        await Promise.all([
          f.updateSettings(h.data(), PL, f.changedSettings),
          f.updateSettings(h.data(), EN, enSettings),
        ]);
      });

      expect(settings(PL)).toEqual(f.changedSettings);
      expect(settings(EN)).toEqual(enSettings);
      expect(await f.loadSettings(EN)).toEqual(enSettings);
    });
  }
);

describe.each(
  [vocabulary, sentences, declension, aspectPairs].map(
    (feature) => [feature.name, feature] as const
  )
)('%s reset', (_name, feature) => {
  test('afterwards, the settings shown are the ones a reload would load', async () => {
    const { h, settings, f } = setup(feature, withOtherDirection());
    await h.run(() => f.updateSettings(h.data(), PL, f.changedSettings));

    await h.run(() => f.clear(h.data(), PL));

    expect(settings()).toEqual(await f.loadSettings(PL));
  });
});

describe('conjugation reset', () => {
  test('afterwards, the settings shown are the ones a reload would load', async () => {
    const { h, settings, f } = setup(conjugation, withOtherDirection());
    await h.run(() => f.updateSettings(h.data(), PL, f.changedSettings));

    await h.run(() => f.clear(h.data(), PL));

    expect(settings()).toEqual(await f.loadSettings(PL));
  });

  test('keeps the other direction’s settings, shown and stored', async () => {
    const { h, uid, settings, f } = setup(conjugation, withOtherDirection());
    await h.run(() => f.updateSettings(h.data(), EN, f.changedSettings));

    await h.run(() => f.clear(h.data(), PL));

    expect(settings(EN)).toEqual(f.changedSettings);
    expect(serverDoc(uid, f.settingsDoc(EN))).toEqual(f.changedSettings);
  });
});

describe('declension and aspect-pair resets', () => {
  test.each([declension, aspectPairs].map((f) => [f.name, f] as const))(
    '%s: the settings go back to their defaults, shown and stored',
    async (_name, f) => {
      const { h, uid, settings } = setup(f, withOtherDirection());
      const defaults = settings();
      await h.run(() => f.updateSettings(h.data(), PL, f.changedSettings));

      await h.run(() => f.clear(h.data(), PL));

      expect(settings()).toEqual(defaults);
      expect(serverDoc(uid, f.settingsDoc(PL))).toBeUndefined();
    }
  );
});
