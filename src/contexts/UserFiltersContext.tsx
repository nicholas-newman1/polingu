import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserFilters } from '../types/userFilters';
import type { ConjugationFilters } from '../types/conjugation';
import type { DeclensionFilters } from '../lib/declensionScheduler/types';
import { DEFAULT_USER_FILTERS } from '../types/userFilters';
import loadUserFilters from '../lib/storage/loadUserFilters';
import saveUserFilters from '../lib/storage/saveUserFilters';
import { useAuthContext } from '../hooks/useAuthContext';

interface UserFiltersContextType {
  filters: UserFilters;
  filtersLoading: boolean;
  updateConjugationFilters: (filters: ConjugationFilters) => void;
  updateDeclensionFilters: (filters: DeclensionFilters) => void;
}

const UserFiltersContext = createContext<UserFiltersContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useUserFilters(): UserFiltersContextType {
  const context = useContext(UserFiltersContext);
  if (!context) {
    throw new Error('useUserFilters must be used within UserFiltersProvider');
  }
  return context;
}

interface UserFiltersProviderProps {
  children: ReactNode;
}

export function UserFiltersProvider({ children }: UserFiltersProviderProps) {
  const { user } = useAuthContext();
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_USER_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (user) {
      loadUserFilters().then((loaded) => {
        if (!cancelled) {
          setFilters(loaded);
          setLoading(false);
        }
      });
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setFilters(DEFAULT_USER_FILTERS);
          setLoading(false);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateConjugationFilters = useCallback(
    (conjugation: ConjugationFilters) => {
      const updated = { ...filters, conjugation };
      setFilters(updated);
      saveUserFilters(updated);
    },
    [filters]
  );

  const updateDeclensionFilters = useCallback(
    (declension: DeclensionFilters) => {
      const updated = { ...filters, declension };
      setFilters(updated);
      saveUserFilters(updated);
    },
    [filters]
  );

  return (
    <UserFiltersContext.Provider
      value={{
        filters,
        filtersLoading: loading,
        updateConjugationFilters,
        updateDeclensionFilters,
      }}
    >
      {children}
    </UserFiltersContext.Provider>
  );
}
