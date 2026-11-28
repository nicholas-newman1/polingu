/** How each deck's items become session cards; scheduler.ts builds the sessions. */
import { createEmptyCard } from 'ts-fsrs';
import type {
  DeclensionCard,
  DeclensionCardId,
  DeclensionCardReviewData,
  DeclensionFilters,
  DeclensionSessionCard,
} from '../../types';
import type {
  VocabularyCardReviewData,
  VocabularySessionCard,
  VocabularyWord,
  VocabularyWordId,
} from '../../types/vocabulary';
import type { Sentence, SentenceCardReviewData, SentenceSessionCard } from '../../types/sentences';
import type {
  ConjugationFilters,
  ConjugationFormKey,
  ConjugationFormReviewData,
  ConjugationSessionCard,
  DrillableForm,
} from '../../types/conjugation';
import type {
  AspectPairCard,
  AspectPairsCardReviewData,
  AspectPairsSessionCard,
} from '../../types/aspectPairs';
import { matchesFilters as matchesConjugationFilters } from '../conjugationUtils';
import type { ReviewDeck } from './scheduler';

export function matchesDeclensionFilters(
  card: DeclensionCard,
  filters: DeclensionFilters
): boolean {
  if (filters.cases.length > 0 && !filters.cases.includes(card.case)) return false;
  if (filters.genders.length > 0 && !filters.genders.includes(card.gender)) return false;
  if (filters.number !== 'All' && card.number !== filters.number) return false;
  return true;
}

/** Declension cards; new ones are shuffled. */
export const declensionDeck: ReviewDeck<
  DeclensionCard,
  DeclensionCardReviewData,
  DeclensionCardId,
  DeclensionSessionCard,
  DeclensionFilters
> = {
  idOf: (card) => card.id,
  newReviewData: (cardId) => ({ cardId, fsrsCard: createEmptyCard() }),
  toSessionCard: (card, reviewData, isNew) => ({ card, reviewData, isNew }),
  isCustom: (card) => card.isCustom === true,
  shuffleNew: true,
  matches: matchesDeclensionFilters,
};

/** Vocabulary words; "Study next" and "Review again" put a word first among the new ones. */
export const vocabularyDeck: ReviewDeck<
  VocabularyWord,
  VocabularyCardReviewData,
  VocabularyWordId,
  VocabularySessionCard,
  never
> = {
  idOf: (word) => word.id,
  newReviewData: (wordId) => ({ wordId, fsrsCard: createEmptyCard() }),
  toSessionCard: (word, reviewData, isNew) => ({ word, reviewData, isNew }),
  isCustom: (word) => word.isCustom === true,
  prioritizedAt: (reviewData) => reviewData.prioritizedAt,
};

/** Sentences. The selected CEFR levels are applied to the list before it reaches the scheduler. */
export const sentenceDeck: ReviewDeck<
  Sentence,
  SentenceCardReviewData,
  string,
  SentenceSessionCard,
  never
> = {
  idOf: (sentence) => sentence.id,
  newReviewData: (sentenceId) => ({ sentenceId, fsrsCard: createEmptyCard() }),
  toSessionCard: (sentence, reviewData, isNew) => ({ sentence, reviewData, isNew }),
  isCustom: (sentence) => sentence.isCustom === true,
};

/** Conjugation forms (getDrillableFormsForVerb), each reviewed on its own. */
export const conjugationDeck: ReviewDeck<
  DrillableForm,
  ConjugationFormReviewData,
  ConjugationFormKey,
  ConjugationSessionCard,
  ConjugationFilters
> = {
  idOf: (form) => form.fullFormKey,
  newReviewData: (formKey) => ({ formKey, fsrsCard: createEmptyCard() }),
  toSessionCard: (form, reviewData, isNew) => ({ form, reviewData, isNew }),
  matches: matchesConjugationFilters,
};

/** Aspect pairs, keyed by the first verb of the pair. */
export const aspectPairsDeck: ReviewDeck<
  AspectPairCard,
  AspectPairsCardReviewData,
  string,
  AspectPairsSessionCard,
  never
> = {
  idOf: (card) => card.verb.id,
  newReviewData: (verbId) => ({ verbId, fsrsCard: createEmptyCard() }),
  toSessionCard: (card, reviewData, isNew) => ({ card, reviewData, isNew }),
};
