import { createContext, useContext, type ReactNode } from 'react';
import type { UserFilters } from '../types/userFilters';
import type { ConjugationFilters } from '../types/conjugation';
import type { DeclensionFilters } from '../types';
import { userFiltersDoc } from '../lib/storage/userDocs';
import { useUserDoc } from '../hooks/useUserDoc';

interface UserFiltersContextType {
  filters: UserFilters;
  filtersLoading: boolean;
  updateConjugationFilters: (filters: ConjugationFilters) => void;
  updateDeclensionFilters: (filters: DeclensionFilters) => void;
}

const UserFiltersContext = createContext<UserFiltersContextType | null>(null);

export function useUserFilters(): UserFiltersContextType {
  const context = useContext(UserFiltersContext);
  if (!context) {
    throw new Error('useUserFilters must be used within UserFiltersProvider');
  }
  return context;
}

/** The filters context, or null outside a UserFiltersProvider. */
export function useOptionalUserFilters(): UserFiltersContextType | null {
  return useContext(UserFiltersContext);
}

export function UserFiltersProvider({ children }: { children: ReactNode }) {
  const { value: filters, loading, update } = useUserDoc(userFiltersDoc);

  return (
    <UserFiltersContext.Provider
      value={{
        filters,
        filtersLoading: loading,
        updateConjugationFilters: (conjugation) => void update({ ...filters, conjugation }),
        updateDeclensionFilters: (declension) => void update({ ...filters, declension }),
      }}
    >
      {children}
    </UserFiltersContext.Provider>
  );
}
