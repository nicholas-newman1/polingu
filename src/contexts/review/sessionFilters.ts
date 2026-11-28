import { useOptionalUserFilters } from '../UserFiltersContext';
import { DEFAULT_USER_FILTERS, type UserFilters } from '../../types/userFilters';

/**
 * The learner's session filters, which limit the new cards a declension or
 * conjugation session serves, so due counts can match the sessions. Outside a
 * UserFiltersProvider (the review providers rendered on their own) nothing is
 * filtered out.
 */
export function useSessionFilters(): UserFilters {
  return useOptionalUserFilters()?.filters ?? DEFAULT_USER_FILTERS;
}
