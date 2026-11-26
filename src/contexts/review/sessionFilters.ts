import { useOptionalUserFilters } from '../UserFiltersContext';
import { DEFAULT_USER_FILTERS, type UserFilters } from '../../types/userFilters';
import type { ReviewBucket } from '../../lib/fsrsUtils/getReviewBucket';

/**
 * The learner's session filters, which limit the new cards a declension or
 * conjugation session serves, so due counts can match the sessions. Outside a
 * UserFiltersProvider (the review providers rendered on their own) nothing is
 * filtered out.
 */
export function useSessionFilters(): UserFilters {
  return useOptionalUserFilters()?.filters ?? DEFAULT_USER_FILTERS;
}

/** A new card the session filters leave out is not due (the session would not serve it). */
export const unlessFilteredOut = (bucket: ReviewBucket, matches: boolean): ReviewBucket =>
  bucket === 'new' && !matches ? null : bucket;
