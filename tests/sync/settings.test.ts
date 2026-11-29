import { describe, expect, test, vi } from 'vitest';
import {
  appSettingsDoc,
  listeningHubSelectionsDoc,
  listeningSettingsDoc,
  userFiltersDoc,
} from '../../src/lib/storage/userDocs';
import { DEFAULT_APP_SETTINGS } from '../../src/types/appSettings';
import { DEFAULT_USER_FILTERS, type UserFilters } from '../../src/types/userFilters';
import {
  DEFAULT_LISTENING_HUB_SELECTIONS,
  DEFAULT_LISTENING_SETTINGS,
  type ListeningHubSelections,
  type ListeningSettings,
} from '../../src/types/listening';
import { ALL_LEVELS } from '../../src/types/sentences';
import type { TranslationDirection } from '../../src/types/common';
import { userDb } from '../../src/lib/offlineDb/userDb';
import { remote } from './support/fakeFirestore';
import { network, setupSyncTests, signIn, userPath } from './support/harness';
import { stub } from '../helpers/stub';
import {
  aspectPairsStorage,
  conjugationStorage,
  declensionStorage,
  loadDeckSettings,
  saveDeckSettings,
  sentenceStorage,
  vocabularyStorage,
} from '../../src/lib/storage/reviewDeckStorage';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

/** Both directions' settings, as a reload loads them. */
const loadBothDirections = async <Settings>(
  parts: Record<TranslationDirection, Parameters<typeof loadDeckSettings<Settings>>[0]>
) => ({
  'pl-to-en': await loadDeckSettings(parts['pl-to-en']),
  'en-to-pl': await loadDeckSettings(parts['en-to-pl']),
});

setupSyncTests();

const UID = 'learner-a';
const seedDoc = (name: string, data: Record<string, unknown>) =>
  remote.seed(userPath(UID, 'data', name), data);

describe('settings saved by an older version of the app', () => {
  test('app settings gain defaults for fields added since', async () => {
    signIn(UID);
    seedDoc('appSettings', { autoPlayAudio: true });

    expect(await appSettingsDoc.load()).toEqual({ ...DEFAULT_APP_SETTINGS, autoPlayAudio: true });
  });

  test('filters are filled in per feature, keeping what was saved', async () => {
    signIn(UID);
    seedDoc('userFilters', { declension: { cases: ['Genitive'] } });

    expect(await userFiltersDoc.load()).toEqual({
      conjugation: DEFAULT_USER_FILTERS.conjugation,
      declension: { ...DEFAULT_USER_FILTERS.declension, cases: ['Genitive'] },
    });
  });

  test('sentence settings keep the saved daily limit and default to every level', async () => {
    signIn(UID);
    seedDoc('sentenceSettings-pl-en', { newCardsPerDay: 3 });

    const settings = await loadBothDirections(sentenceStorage);

    expect(settings['pl-to-en']).toEqual({ newCardsPerDay: 3, selectedLevels: ALL_LEVELS });
    expect(settings['en-to-pl']).toEqual({ newCardsPerDay: 5, selectedLevels: ALL_LEVELS });
  });
});

describe('listening settings are sanitised on load', () => {
  test('out-of-range or unknown values fall back to the defaults, valid ones are kept', async () => {
    signIn(UID);
    seedDoc('listeningSettings', {
      playbackRate: 5,
      ordering: 'alphabetical',
      learned: { gapBetweenCards: 3, repetitions: 2 },
      unknown: { gapBetweenCards: 8, repetitions: 9, gapBetweenRepetitions: 'long' },
    });

    expect(await listeningSettingsDoc.load()).toEqual({
      playbackRate: DEFAULT_LISTENING_SETTINGS.playbackRate,
      ordering: DEFAULT_LISTENING_SETTINGS.ordering,
      learned: { ...DEFAULT_LISTENING_SETTINGS.learned, repetitions: 2 },
      unknown: { ...DEFAULT_LISTENING_SETTINGS.unknown, gapBetweenCards: 8 },
    });
  });

  test('a valid saved configuration round-trips unchanged', async () => {
    signIn(UID);
    const custom: ListeningSettings = {
      playbackRate: 0.5,
      ordering: 'due',
      learned: { gapBetweenCards: 0.5, repetitions: 3, gapBetweenRepetitions: 4 },
      unknown: { gapBetweenCards: 8, repetitions: 1, gapBetweenRepetitions: 2 },
    };

    await listeningSettingsDoc.save(custom);

    expect(await listeningSettingsDoc.load()).toEqual(custom);
    expect(remote.get(userPath(UID, 'data', 'listeningSettings'))).toEqual(custom);
  });

  test('hub selections drop unknown levels and fall back to all levels when none remain', async () => {
    signIn(UID);
    seedDoc('listeningHubSelections', {
      feature: 'conjugation',
      direction: 'en-to-pl',
      selectedLevels: ['B1', 'Z9'],
    });
    expect(await listeningHubSelectionsDoc.load()).toEqual({
      feature: DEFAULT_LISTENING_HUB_SELECTIONS.feature,
      direction: 'en-to-pl',
      selectedLevels: ['B1'],
    });

    await listeningHubSelectionsDoc.save(
      stub<ListeningHubSelections>({ feature: 'vocabulary', selectedLevels: [] })
    );
    expect(await listeningHubSelectionsDoc.load()).toEqual({
      ...DEFAULT_LISTENING_HUB_SELECTIONS,
      feature: 'vocabulary',
    });
  });
});

describe('per-direction settings', () => {
  test('each direction is saved to its own doc and loads independently', async () => {
    signIn(UID);

    await saveDeckSettings(sentenceStorage['en-to-pl'], {
      newCardsPerDay: 2,
      selectedLevels: ['A1'],
    });
    await saveDeckSettings(vocabularyStorage['pl-to-en'], { newCardsPerDay: 25 });
    await saveDeckSettings(conjugationStorage['en-to-pl'], { newCardsPerDay: 1 });

    expect(await loadBothDirections(sentenceStorage)).toEqual({
      'pl-to-en': { newCardsPerDay: 5, selectedLevels: ALL_LEVELS },
      'en-to-pl': { newCardsPerDay: 2, selectedLevels: ['A1'] },
    });
    expect(await loadBothDirections(vocabularyStorage)).toEqual({
      'pl-to-en': { newCardsPerDay: 25 },
      'en-to-pl': { newCardsPerDay: 10 },
    });
    expect(await loadBothDirections(conjugationStorage)).toEqual({
      'pl-to-en': { newCardsPerDay: 10 },
      'en-to-pl': { newCardsPerDay: 1 },
    });
    expect(remote.get(userPath(UID, 'data', 'vocabularySettings-pl-en'))).toEqual({
      newCardsPerDay: 25,
    });
  });
});

describe('every settings doc round-trips through the server', () => {
  test('a second device sees what the first one saved', async () => {
    signIn(UID);
    const filters: UserFilters = {
      ...DEFAULT_USER_FILTERS,
      declension: { cases: ['Dative'], genders: ['Feminine'], number: 'Plural' },
    };
    await appSettingsDoc.save({ autoPlayAudio: true, hidePolishText: true, dashboardOrder: ['x'] });
    await userFiltersDoc.save(filters);
    await saveDeckSettings(declensionStorage.all, { newCardsPerDay: 4 });
    await saveDeckSettings(aspectPairsStorage.all, { newCardsPerDay: 6 });

    // A fresh device: nothing cached locally, everything comes from the server.
    const server = remote.list(userPath(UID, 'data'));
    remote.reset();
    for (const [name, data] of Object.entries(server)) seedDoc(name, data);
    await userDb.userData.clear();

    expect(await appSettingsDoc.load()).toEqual({
      autoPlayAudio: true,
      hidePolishText: true,
      dashboardOrder: ['x'],
    });
    expect(await userFiltersDoc.load()).toEqual(filters);
    expect(await loadDeckSettings(declensionStorage.all)).toEqual({ newCardsPerDay: 4 });
    expect(await loadDeckSettings(aspectPairsStorage.all)).toEqual({ newCardsPerDay: 6 });
  });
});

describe('guest', () => {
  test('gets the defaults and saving is a no-op', async () => {
    await appSettingsDoc.save({ autoPlayAudio: true, hidePolishText: true });
    await saveDeckSettings(declensionStorage.all, { newCardsPerDay: 99 });

    expect(await appSettingsDoc.load()).toEqual(DEFAULT_APP_SETTINGS);
    expect(await loadDeckSettings(declensionStorage.all)).toEqual({ newCardsPerDay: 10 });
    expect(remote.calls).toEqual([]);
  });
});

describe('offline', () => {
  test('a settings change made offline is used at once and synced later', async () => {
    signIn(UID);
    network.goOffline();

    await saveDeckSettings(declensionStorage.all, { newCardsPerDay: 20 });

    expect(await loadDeckSettings(declensionStorage.all)).toEqual({ newCardsPerDay: 20 });
    expect(remote.get(userPath(UID, 'data', 'settings'))).toBeUndefined();
  });
});
