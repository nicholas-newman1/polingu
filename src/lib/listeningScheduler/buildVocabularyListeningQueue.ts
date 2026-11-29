import type { VocabularyWord, VocabularyReviewDataStore } from '../../types/vocabulary';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import { vocabularyDeck } from '../reviewSession/reviewDecks';
import buildListeningQueue from './buildListeningQueue';

export interface BuildVocabularyListeningQueueArgs {
  words: VocabularyWord[];
  reviewStore: VocabularyReviewDataStore;
  ordering: ListeningOrdering;
}

export default function buildVocabularyListeningQueue({
  words,
  reviewStore,
  ordering,
}: BuildVocabularyListeningQueueArgs): ListeningQueueItem[] {
  return buildListeningQueue({
    items: words,
    deck: vocabularyDeck,
    reviewStore,
    ordering,
    feature: 'vocabulary',
    idPrefix: 'vocabulary',
    text: (word) => ({ primaryText: word.polish, secondaryText: word.english }),
  });
}
