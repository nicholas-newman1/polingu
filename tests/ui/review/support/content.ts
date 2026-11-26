/**
 * Content and progress fixtures, written straight to the fake Firestore server
 * the way the app stores them, so the real providers load them on mount.
 */
import { State, type Card } from 'ts-fsrs';
import { remote } from '../../../sync/support/fakeFirestore';
import { userPath } from '../../../sync/support/harness';
import { fsrsCard, inDays } from '../../../helpers/fsrs';
import type { VocabularyWord } from '../../../../src/types/vocabulary';
import type { DeclensionCard } from '../../../../src/types';
import type { Sentence } from '../../../../src/types/sentences';
import type { ConjugationForm, Verb } from '../../../../src/types/conjugation';
import { userDb, type CustomCardCollection } from '../../../../src/lib/offlineDb/userDb';

export { State };

/** The signed-in learner. */
export const UID = 'learner';

/** Noon on a Tuesday, well away from midnight and daylight-saving changes. */
export const NOW = new Date('2026-03-10T12:00:00');
export const TODAY = '2026-03-10';

// ---------------------------------------------------------------------------
// Content

export const word = (
  id: number,
  polish: string,
  english: string,
  extra: Partial<VocabularyWord> = {}
): VocabularyWord => ({
  id,
  polish,
  english,
  audioUrl: `https://audio.test/word-${id}.mp3`,
  ...extra,
});

export const declensionCard = (
  id: number,
  front: string,
  back: string,
  declined: string,
  extra: Partial<DeclensionCard> = {}
): DeclensionCard => ({
  id,
  front,
  back,
  declined,
  case: 'Genitive',
  gender: 'Feminine',
  number: 'Singular',
  english: `${front} (en)`,
  ...extra,
});

export const sentence = (
  id: string,
  polish: string,
  english: string,
  extra: Partial<Sentence> = {}
): Sentence => ({
  id,
  polish,
  english,
  level: 'A1',
  tags: [],
  ...extra,
});

const presentForms = (stem: string, english: string): Record<string, ConjugationForm> => ({
  '1sg': { pl: `${stem}m`, en: [`I ${english}`] },
  '2sg': { pl: `${stem}sz`, en: [`you ${english}`] },
  '3sg': { pl: stem, en: [`he ${english}s`] },
  '1pl': { pl: `${stem}my`, en: [`we ${english}`] },
  '2pl': { pl: `${stem}cie`, en: [`you all ${english}`] },
  '3pl': { pl: `${stem}ją`, en: [`they ${english}`] },
});

/** A regular -ać verb with present-tense forms only (6 drillable forms). */
export const verb = (id: string, stem: string, english: string, extra: Partial<Verb> = {}): Verb =>
  ({
    id,
    infinitive: `${stem}ć`,
    infinitiveEn: `to ${english}`,
    aspect: 'Imperfective',
    verbClass: '-ać',
    isIrregular: false,
    isReflexive: false,
    conjugations: { present: presentForms(stem, english) },
    ...extra,
  }) as Verb;

// ---------------------------------------------------------------------------
// Progress

/** A card the learner graduated, due `days` from now (negative: overdue). */
export const reviewCardDueIn = (days: number) => fsrsCard(State.Review, inDays(days));

/** A card the learner has started but not graduated, due `minutes` from now. */
export const learningCardDueIn = (minutes: number): Card =>
  fsrsCard(State.Learning, new Date(Date.now() + minutes * 60_000), {
    stability: 1,
    scheduled_days: 0,
    last_review: new Date(Date.now() - 10 * 60_000),
  });

/** Review cards are stored with ISO date strings, as the app serializes them. */
function serializeCard(card: Card) {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Server

const seedAll = <T extends { id: string | number }>(collection: string, items: T[]) =>
  items.forEach((item) => remote.seed(`${collection}/${item.id}`, item));

export const seed = {
  vocabulary: (...words: VocabularyWord[]) => seedAll('vocabulary', words),
  declensionCards: (...cards: DeclensionCard[]) => seedAll('declensionCards', cards),
  sentences: (...sentences: Sentence[]) => seedAll('sentences', sentences),
  verbs: (...verbs: Verb[]) => seedAll('verbs', verbs),

  /** A document under users/{uid}/data, such as settings or a review session. */
  userDoc: (key: string, data: object) => remote.seed(userPath(UID, 'data', key), data),

  /**
   * A custom item the learner created earlier on this device: on the server under
   * users/{uid}/{collection}, and in the local cache the review pages load from.
   */
  customItem: async (
    collection: CustomCardCollection,
    item: { id: string; [field: string]: unknown }
  ) => {
    remote.seed(userPath(UID, collection, item.id), item);
    await userDb.customCards.put({
      compoundKey: `${collection}:${item.id}`,
      collection,
      cardId: item.id,
      data: item,
      lastModified: 0,
      pendingSync: 0,
      pendingDelete: 0,
    });
  },

  /** The learner's progress on one card, under users/{uid}/{collection}/{id}. */
  progress: (collection: string, id: string | number, idField: string, card: Card) =>
    remote.seed(userPath(UID, collection, String(id)), {
      [idField]: id,
      fsrsCard: serializeCard(card),
    }),
};

/** The learner's progress on one card as the server holds it, or undefined. */
export function storedCard(collection: string, id: string | number) {
  const data = remote.get(userPath(UID, collection, String(id)));
  if (!data) return undefined;
  const card = data.fsrsCard as { state: State; due: string; reps: number };
  return { state: card.state, due: new Date(card.due), reps: card.reps };
}

/** A users/{uid}/data document as the server holds it. */
export const storedDoc = (key: string) => remote.get(userPath(UID, 'data', key));

/** Ids of every card in a progress collection on the server. */
export const storedIds = (collection: string) =>
  Object.keys(remote.list(userPath(UID, collection)));
