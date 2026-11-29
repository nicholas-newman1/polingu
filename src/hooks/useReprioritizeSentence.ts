import { useReprioritize } from './useReprioritize';
import { useSentences } from './useReviewData';

export function useReprioritizeSentence() {
  const { progress } = useSentences();
  return useReprioritize({
    progress,
    queuedMessage: 'Sentence queued for review again.',
    duplicateMessage: 'This sentence is already in your collection.',
  });
}
