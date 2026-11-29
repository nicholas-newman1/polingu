import type { CardReviewData, ReviewDataStore, SessionId } from '../../types/common';
import type {
  ListeningFeature,
  ListeningOrdering,
  ListeningQueueItem,
} from '../../types/listening';
import { reviewDataFor, type ReviewDeck } from '../reviewSession/scheduler';
import isFsrsCardLearned from './isFsrsCardLearned';
import orderListeningPool from './orderListeningPool';

interface ListeningSource<Item, R extends CardReviewData, Id extends SessionId> {
  items: readonly Item[];
  deck: Pick<ReviewDeck<Item, R, Id, unknown, unknown>, 'idOf' | 'newReviewData'>;
  reviewStore: ReviewDataStore<R, Id>;
  ordering: ListeningOrdering;
  feature: ListeningFeature;
  /** Prefixes item ids in the queue, so ids from different features never collide. */
  idPrefix: string;
  /** Whether the item belongs in the queue, beyond having audio. */
  include?: (item: Item) => boolean;
  /** What the player shows for the item. */
  text: (item: Item) => Pick<ListeningQueueItem, 'primaryText' | 'secondaryText'>;
}

/** The items with audio, in the chosen order, each marked learned or not by its review data. */
export default function buildListeningQueue<
  Item extends { audioUrl?: string; isCustom?: boolean },
  R extends CardReviewData,
  Id extends SessionId,
>({
  items,
  deck,
  reviewStore,
  ordering,
  feature,
  idPrefix,
  include = () => true,
  text,
}: ListeningSource<Item, R, Id>): ListeningQueueItem[] {
  const pool = orderListeningPool(
    items
      .filter((item) => !!item.audioUrl && include(item))
      .map((item) => ({ item, reviewData: reviewDataFor(deck, reviewStore, deck.idOf(item)) })),
    ordering
  );

  return pool.map(({ item, reviewData }) => ({
    id: `${idPrefix}:${deck.idOf(item)}`,
    feature,
    audioUrl: item.audioUrl!,
    ...text(item),
    isLearned: isFsrsCardLearned(reviewData.fsrsCard),
  }));
}
