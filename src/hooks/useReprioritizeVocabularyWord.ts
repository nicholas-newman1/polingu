import { useCallback, useEffect, useRef } from 'react';
import reprioritizeVocabularyWord, {
  canReprioritizeVocabularyWord,
  prioritizeNewVocabularyWord,
} from '../lib/storage/reprioritizeVocabularyWord';
import {
  findCustomWordWithSamePolish,
  findWordWithSamePolish,
} from '../lib/utils/findDuplicateCustomVocabularyPolish';
import type { CustomVocabularyWord, VocabularyWordId } from '../types/vocabulary';
import type { TranslationDirection } from '../types/common';
import { useDirectionalReprioritize } from './useDirectionalReprioritize';
import { useSnackbar } from './useSnackbar';
import { useVocabulary } from './useReviewData';

const BUILT_IN_DUPLICATE_MESSAGE = 'This Polish word is already in the built-in deck.';
const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];
const STUDY_NEXT_MESSAGE = 'Word moved to the front of your new words.';

export function useReprioritizeVocabularyWord() {
  const { vocabularyReviewStores, updateVocabularyReviewStore, systemWords } = useVocabulary();
  const { showSnackbar } = useSnackbar();
  // "Study next" can be clicked seconds after the warning appears; use the stores of that moment.
  const storesRef = useRef(vocabularyReviewStores);
  useEffect(() => {
    storesRef.current = vocabularyReviewStores;
  }, [vocabularyReviewStores]);
  const { canReprioritize, reprioritize, showDuplicateError } = useDirectionalReprioritize({
    stores: vocabularyReviewStores,
    updateStore: updateVocabularyReviewStore,
    reprioritize: reprioritizeVocabularyWord,
    canReprioritize: canReprioritizeVocabularyWord,
    queuedMessage: 'Word queued for review again.',
    duplicateMessage: 'This Polish word is already in your custom vocabulary.',
  });

  const studyNext = useCallback(
    (wordId: VocabularyWordId) => {
      for (const direction of DIRECTIONS) {
        const store = storesRef.current[direction];
        const next = prioritizeNewVocabularyWord(store, wordId);
        if (next !== store) void updateVocabularyReviewStore(direction, next);
      }
      showSnackbar(STUDY_NEXT_MESSAGE, 'success');
    },
    [updateVocabularyReviewStore, showSnackbar]
  );

  /**
   * Shows the duplicate warning if `polish` is already one of `customWords` or a built-in
   * word, and returns whether it was. A studied word can be reviewed again; a built-in word
   * not studied yet can be moved to the front of the new words instead.
   */
  const reportDuplicatePolish = useCallback(
    (customWords: CustomVocabularyWord[], polish: string) => {
      const custom = findCustomWordWithSamePolish(customWords, polish);
      if (custom) {
        showDuplicateError(custom.id);
        return true;
      }
      const builtIn = findWordWithSamePolish(systemWords, polish);
      if (builtIn) {
        if (canReprioritize(builtIn.id)) {
          showDuplicateError(builtIn.id, BUILT_IN_DUPLICATE_MESSAGE);
        } else {
          showSnackbar(BUILT_IN_DUPLICATE_MESSAGE, 'error', {
            action: {
              label: 'Study next',
              onClick: () => studyNext(builtIn.id),
            },
          });
        }
        return true;
      }
      return false;
    },
    [systemWords, showDuplicateError, canReprioritize, showSnackbar, studyNext]
  );

  return { canReprioritize, reprioritize, showDuplicateError, reportDuplicatePolish };
}
