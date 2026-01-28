import { useMemo } from 'react';
import { State } from 'ts-fsrs';
import { useReviewData } from './useReviewData';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import getOrCreateSentenceCardReviewData from '../lib/storage/getOrCreateSentenceCardReviewData';
import getOrCreateConjugationFormReviewData from '../lib/storage/getOrCreateConjugationFormReviewData';
import isDue from '../lib/fsrsUtils/isDue';
import {
  includesDeclensionCardId,
  includesSentenceId,
  includesFormKey,
} from '../lib/storage/helpers';
import type { VocabularyDirection } from '../types/vocabulary';
import type { SentenceDirection, CEFRLevel } from '../types/sentences';
import { ALL_LEVELS } from '../types/sentences';
import type { ConjugationDirection } from '../types/conjugation';
import { getDrillableFormsForVerb } from '../lib/conjugationUtils';

export interface ProgressStats {
  total: number;
  learned: number;
  mastered: number;
  due: number;
}

export interface SentenceDirectionStats {
  total: ProgressStats;
  byLevel: Record<CEFRLevel, ProgressStats>;
}

export interface AllProgressStats {
  declension: ProgressStats;
  vocabulary: ProgressStats;
  vocabularyByDirection: Record<VocabularyDirection, ProgressStats>;
  sentences: ProgressStats;
  sentencesByDirection: Record<SentenceDirection, SentenceDirectionStats>;
  conjugation: ProgressStats;
  conjugationByDirection: Record<ConjugationDirection, ProgressStats>;
}

export function useProgressStats(): AllProgressStats {
  const {
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
    sentences,
    sentenceReviewStores,
    sentenceSettings,
    verbs,
    conjugationReviewStores,
    conjugationSettings,
  } = useReviewData();

  return useMemo(() => {
    let declensionLearned = 0;
    let declensionMastered = 0;
    let declensionDue = 0;
    const declensionRemainingNew =
      declensionSettings.newCardsPerDay - declensionReviewStore.newCardsToday.length;
    let declensionNewForSession = 0;

    for (const card of declensionCards) {
      const reviewData = getOrCreateDeclensionCardReviewData(card.id, declensionReviewStore);
      const cardState = reviewData.fsrsCard.state;

      if (cardState !== State.New) {
        declensionLearned++;
      }
      if (cardState === State.Review) {
        declensionMastered++;
      }

      const isNew = cardState === State.New;
      const isLearning = cardState === State.Learning || cardState === State.Relearning;

      if (isNew) {
        if (
          !includesDeclensionCardId(declensionReviewStore.newCardsToday, card.id) &&
          declensionNewForSession < declensionRemainingNew
        ) {
          declensionNewForSession++;
          declensionDue++;
        }
      } else if (isLearning) {
        if (!includesDeclensionCardId(declensionReviewStore.reviewedToday, card.id)) {
          declensionDue++;
        }
      } else if (isDue(reviewData.fsrsCard)) {
        if (!includesDeclensionCardId(declensionReviewStore.reviewedToday, card.id)) {
          declensionDue++;
        }
      }
    }

    const computeVocabStats = (direction: VocabularyDirection): ProgressStats => {
      const store = vocabularyReviewStores[direction];
      const directionSettings = vocabularySettings[direction];
      let learned = 0;
      let mastered = 0;
      let due = 0;
      const remainingNew = directionSettings.newCardsPerDay - store.newCardsToday.length;
      let newForSession = 0;

      for (const word of vocabularyWords) {
        const reviewData = getOrCreateVocabularyCardReviewData(word.id, store);
        const cardState = reviewData.fsrsCard.state;

        if (cardState !== State.New) {
          learned++;
        }
        if (cardState === State.Review) {
          mastered++;
        }

        const isNew = cardState === State.New;
        const isLearning = cardState === State.Learning || cardState === State.Relearning;

        if (isNew) {
          const isAlreadyNew = store.newCardsToday.some((id) => String(id) === String(word.id));
          if (!isAlreadyNew && newForSession < remainingNew) {
            newForSession++;
            due++;
          }
        } else if (isLearning) {
          const isAlreadyReviewed = store.reviewedToday.some(
            (id) => String(id) === String(word.id)
          );
          if (!isAlreadyReviewed) {
            due++;
          }
        } else if (isDue(reviewData.fsrsCard)) {
          const isAlreadyReviewed = store.reviewedToday.some(
            (id) => String(id) === String(word.id)
          );
          if (!isAlreadyReviewed) {
            due++;
          }
        }
      }

      return { total: vocabularyWords.length, learned, mastered, due };
    };

    const plToEn = computeVocabStats('pl-to-en');
    const enToPl = computeVocabStats('en-to-pl');

    let combinedLearned = 0;
    let combinedMastered = 0;
    const plStore = vocabularyReviewStores['pl-to-en'];
    const enStore = vocabularyReviewStores['en-to-pl'];

    for (const word of vocabularyWords) {
      const plData = getOrCreateVocabularyCardReviewData(word.id, plStore);
      const enData = getOrCreateVocabularyCardReviewData(word.id, enStore);

      if (plData.fsrsCard.state !== State.New || enData.fsrsCard.state !== State.New) {
        combinedLearned++;
      }
      if (plData.fsrsCard.state === State.Review && enData.fsrsCard.state === State.Review) {
        combinedMastered++;
      }
    }

    const computeSentenceStats = (direction: SentenceDirection): SentenceDirectionStats => {
      const store = sentenceReviewStores[direction];
      const directionSettings = sentenceSettings[direction];
      let totalLearned = 0;
      let totalMastered = 0;
      let totalDue = 0;
      const remainingNew = directionSettings.newCardsPerDay - store.newCardsToday.length;
      let newForSession = 0;

      const byLevel = {} as Record<CEFRLevel, ProgressStats>;
      for (const level of ALL_LEVELS) {
        byLevel[level] = { total: 0, learned: 0, mastered: 0, due: 0 };
      }

      for (const sentence of sentences) {
        const level = sentence.level;
        byLevel[level].total++;

        const reviewData = getOrCreateSentenceCardReviewData(sentence.id, store);
        const cardState = reviewData.fsrsCard.state;

        if (cardState !== State.New) {
          totalLearned++;
          byLevel[level].learned++;
        }
        if (cardState === State.Review) {
          totalMastered++;
          byLevel[level].mastered++;
        }

        const isInSelectedLevels = directionSettings.selectedLevels.includes(level);
        if (!isInSelectedLevels) continue;

        const isNew = cardState === State.New;
        const isLearning = cardState === State.Learning || cardState === State.Relearning;

        if (isNew) {
          if (
            !includesSentenceId(store.newCardsToday, sentence.id) &&
            newForSession < remainingNew
          ) {
            newForSession++;
            totalDue++;
            byLevel[level].due++;
          }
        } else if (isLearning) {
          if (!includesSentenceId(store.reviewedToday, sentence.id)) {
            totalDue++;
            byLevel[level].due++;
          }
        } else if (isDue(reviewData.fsrsCard)) {
          if (!includesSentenceId(store.reviewedToday, sentence.id)) {
            totalDue++;
            byLevel[level].due++;
          }
        }
      }

      return {
        total: {
          total: sentences.length,
          learned: totalLearned,
          mastered: totalMastered,
          due: totalDue,
        },
        byLevel,
      };
    };

    const sentencePlToEn = computeSentenceStats('pl-to-en');
    const sentenceEnToPl = computeSentenceStats('en-to-pl');

    let sentenceCombinedLearned = 0;
    let sentenceCombinedMastered = 0;
    const sentencePlStore = sentenceReviewStores['pl-to-en'];
    const sentenceEnStore = sentenceReviewStores['en-to-pl'];

    for (const sentence of sentences) {
      const plData = getOrCreateSentenceCardReviewData(sentence.id, sentencePlStore);
      const enData = getOrCreateSentenceCardReviewData(sentence.id, sentenceEnStore);

      if (plData.fsrsCard.state !== State.New || enData.fsrsCard.state !== State.New) {
        sentenceCombinedLearned++;
      }
      if (plData.fsrsCard.state === State.Review && enData.fsrsCard.state === State.Review) {
        sentenceCombinedMastered++;
      }
    }

    const computeConjugationStats = (direction: ConjugationDirection): ProgressStats => {
      const store = conjugationReviewStores[direction];
      const directionSettings = conjugationSettings[direction];
      let learned = 0;
      let mastered = 0;
      let due = 0;
      let total = 0;
      const remainingNew = directionSettings.newCardsPerDay - store.newFormsToday.length;
      let newForSession = 0;

      for (const verb of verbs) {
        const forms = getDrillableFormsForVerb(verb);
        total += forms.length;

        for (const form of forms) {
          const reviewData = getOrCreateConjugationFormReviewData(form.fullFormKey, store);
          const cardState = reviewData.fsrsCard.state;

          if (cardState !== State.New) {
            learned++;
          }
          if (cardState === State.Review) {
            mastered++;
          }

          const isNew = cardState === State.New;
          const isLearning = cardState === State.Learning || cardState === State.Relearning;

          if (isNew) {
            if (
              !includesFormKey(store.newFormsToday, form.fullFormKey) &&
              newForSession < remainingNew
            ) {
              newForSession++;
              due++;
            }
          } else if (isLearning) {
            if (!includesFormKey(store.reviewedToday, form.fullFormKey)) {
              due++;
            }
          } else if (isDue(reviewData.fsrsCard)) {
            if (!includesFormKey(store.reviewedToday, form.fullFormKey)) {
              due++;
            }
          }
        }
      }

      return { total, learned, mastered, due };
    };

    const conjugationPlToEn = computeConjugationStats('pl-to-en');
    const conjugationEnToPl = computeConjugationStats('en-to-pl');

    let conjugationCombinedLearned = 0;
    let conjugationCombinedMastered = 0;
    let conjugationTotal = 0;
    const conjugationPlStore = conjugationReviewStores['pl-to-en'];
    const conjugationEnStore = conjugationReviewStores['en-to-pl'];

    for (const verb of verbs) {
      const forms = getDrillableFormsForVerb(verb);
      conjugationTotal += forms.length;

      for (const form of forms) {
        const plData = getOrCreateConjugationFormReviewData(form.fullFormKey, conjugationPlStore);
        const enData = getOrCreateConjugationFormReviewData(form.fullFormKey, conjugationEnStore);

        if (plData.fsrsCard.state !== State.New || enData.fsrsCard.state !== State.New) {
          conjugationCombinedLearned++;
        }
        if (plData.fsrsCard.state === State.Review && enData.fsrsCard.state === State.Review) {
          conjugationCombinedMastered++;
        }
      }
    }

    return {
      declension: {
        total: declensionCards.length,
        learned: declensionLearned,
        mastered: declensionMastered,
        due: declensionDue,
      },
      vocabulary: {
        total: vocabularyWords.length,
        learned: combinedLearned,
        mastered: combinedMastered,
        due: plToEn.due + enToPl.due,
      },
      vocabularyByDirection: {
        'pl-to-en': plToEn,
        'en-to-pl': enToPl,
      },
      sentences: {
        total: sentences.length,
        learned: sentenceCombinedLearned,
        mastered: sentenceCombinedMastered,
        due: sentencePlToEn.total.due + sentenceEnToPl.total.due,
      },
      sentencesByDirection: {
        'pl-to-en': sentencePlToEn,
        'en-to-pl': sentenceEnToPl,
      },
      conjugation: {
        total: conjugationTotal,
        learned: conjugationCombinedLearned,
        mastered: conjugationCombinedMastered,
        due: conjugationPlToEn.due + conjugationEnToPl.due,
      },
      conjugationByDirection: {
        'pl-to-en': conjugationPlToEn,
        'en-to-pl': conjugationEnToPl,
      },
    };
  }, [
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
    sentences,
    sentenceReviewStores,
    sentenceSettings,
    verbs,
    conjugationReviewStores,
    conjugationSettings,
  ]);
}
