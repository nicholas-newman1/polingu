import { useCallback } from 'react';
import reprioritizeVocabularyWord, {
  prioritizeNewVocabularyWord,
} from '../lib/storage/reprioritizeVocabularyWord';
import { findWordWithSamePolish } from '../lib/utils/findDuplicateCustomVocabularyPolish';
import type { CustomVocabularyWord, VocabularyWordId } from '../types/vocabulary';
import { useReprioritize } from './useReprioritize';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useVocabulary } from './useReviewData';

const BUILT_IN_DUPLICATE_MESSAGE = 'This Polish word is already in the built-in deck.';
const STUDY_NEXT_MESSAGE = 'Word moved to the front of your new words.';

export function useReprioritizeVocabularyWord() {
  const { progress, systemWords } = useVocabulary();
  const { showSnackbar } = useSnackbar();
  const { canReprioritize, reprioritize, showDuplicateError, updateEachStore } = useReprioritize({
    progress,
    reprioritize: reprioritizeVocabularyWord,
    queuedMessage: 'Word queued for review again.',
    duplicateMessage: 'This Polish word is already in your custom vocabulary.',
  });

  const studyNext = useCallback(
    (wordId: VocabularyWordId) => {
      updateEachStore((store) => prioritizeNewVocabularyWord(store, wordId));
      showSnackbar(STUDY_NEXT_MESSAGE, 'success');
    },
    [updateEachStore, showSnackbar]
  );

  /**
   * Shows the duplicate warning if `polish` is already one of `customWords` or a built-in
   * word, and returns whether it was. A studied word can be reviewed again; a built-in word
   * not studied yet can be moved to the front of the new words instead.
   */
  const reportDuplicatePolish = useCallback(
    (customWords: CustomVocabularyWord[], polish: string) => {
      const custom = findWordWithSamePolish(customWords, polish);
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
