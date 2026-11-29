import type { Sentence, CEFRLevel, SentenceReviewDataStore } from '../../types/sentences';
import type { ListeningOrdering, ListeningQueueItem } from '../../types/listening';
import { sentenceDeck } from '../reviewSession/reviewDecks';
import buildListeningQueue from './buildListeningQueue';

export interface BuildSentenceListeningQueueArgs {
  sentences: Sentence[];
  reviewStore: SentenceReviewDataStore;
  ordering: ListeningOrdering;
  levels?: CEFRLevel[];
}

export default function buildSentenceListeningQueue({
  sentences,
  reviewStore,
  ordering,
  levels,
}: BuildSentenceListeningQueueArgs): ListeningQueueItem[] {
  return buildListeningQueue({
    items: sentences,
    deck: sentenceDeck,
    reviewStore,
    ordering,
    feature: 'sentences',
    idPrefix: 'sentence',
    include: (sentence) => !levels || levels.length === 0 || levels.includes(sentence.level),
    text: (sentence) => ({ primaryText: sentence.polish, secondaryText: sentence.english }),
  });
}
