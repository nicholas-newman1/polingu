import { useMemo } from 'react';
import { State } from 'ts-fsrs';
import { useReviewData } from './useReviewData';
import getOrCreateDeclensionCardReviewData from '../lib/storage/getOrCreateDeclensionCardReviewData';
import getOrCreateVocabularyCardReviewData from '../lib/storage/getOrCreateVocabularyCardReviewData';
import isDue from '../lib/fsrsUtils/isDue';
import { includesDeclensionCardId } from '../lib/storage/helpers';
import type { VocabularyDirection } from '../types/vocabulary';

export interface ProgressStats {
  total: number;
  learned: number;
  mastered: number;
  due: number;
}

export interface AllProgressStats {
  declension: ProgressStats;
  vocabulary: ProgressStats;
  vocabularyByDirection: Record<VocabularyDirection, ProgressStats>;
}

export function useProgressStats(): AllProgressStats {
  const {
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
  } = useReviewData();

  return useMemo(() => {
    let declensionLearned = 0;
    let declensionMastered = 0;
    let declensionDue = 0;
    const declensionRemainingNew =
      declensionSettings.newCardsPerDay -
      declensionReviewStore.newCardsToday.length;
    let declensionNewForSession = 0;

    for (const card of declensionCards) {
      const reviewData = getOrCreateDeclensionCardReviewData(
        card.id,
        declensionReviewStore
      );
      const cardState = reviewData.fsrsCard.state;

      if (cardState !== State.New) {
        declensionLearned++;
      }
      if (cardState === State.Review) {
        declensionMastered++;
      }

      const isNew = cardState === State.New;
      const isLearning =
        cardState === State.Learning || cardState === State.Relearning;

      if (isNew) {
        if (
          !includesDeclensionCardId(
            declensionReviewStore.newCardsToday,
            card.id
          ) &&
          declensionNewForSession < declensionRemainingNew
        ) {
          declensionNewForSession++;
          declensionDue++;
        }
      } else if (isLearning) {
        if (
          !includesDeclensionCardId(
            declensionReviewStore.reviewedToday,
            card.id
          )
        ) {
          declensionDue++;
        }
      } else if (isDue(reviewData.fsrsCard)) {
        if (
          !includesDeclensionCardId(
            declensionReviewStore.reviewedToday,
            card.id
          )
        ) {
          declensionDue++;
        }
      }
    }

    const computeVocabStats = (
      direction: VocabularyDirection
    ): ProgressStats => {
      const store = vocabularyReviewStores[direction];
      let learned = 0;
      let mastered = 0;
      let due = 0;
      const remainingNew =
        vocabularySettings.newCardsPerDay - store.newCardsToday.length;
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
        const isLearning =
          cardState === State.Learning || cardState === State.Relearning;

        if (isNew) {
          const isAlreadyNew = store.newCardsToday.some(
            (id) => String(id) === String(word.id)
          );
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

      if (
        plData.fsrsCard.state !== State.New ||
        enData.fsrsCard.state !== State.New
      ) {
        combinedLearned++;
      }
      if (
        plData.fsrsCard.state === State.Review &&
        enData.fsrsCard.state === State.Review
      ) {
        combinedMastered++;
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
    };
  }, [
    declensionCards,
    declensionReviewStore,
    declensionSettings,
    vocabularyWords,
    vocabularyReviewStores,
    vocabularySettings,
  ]);
}
