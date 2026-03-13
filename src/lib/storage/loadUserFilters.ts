import type { UserFilters } from '../../types/userFilters';
import { DEFAULT_USER_FILTERS } from '../../types/userFilters';
import { loadUserData } from '../offlineDb/userDataWrapper';

export default async function loadUserFilters(): Promise<UserFilters> {
  return loadUserData('userFilters', DEFAULT_USER_FILTERS, (data) => ({
    ...DEFAULT_USER_FILTERS,
    ...(data as Partial<UserFilters>),
    conjugation: {
      ...DEFAULT_USER_FILTERS.conjugation,
      ...((data as Partial<UserFilters>).conjugation ?? {}),
    },
    declension: {
      ...DEFAULT_USER_FILTERS.declension,
      ...((data as Partial<UserFilters>).declension ?? {}),
    },
  }));
}
