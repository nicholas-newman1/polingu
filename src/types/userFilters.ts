import type { ConjugationFilters } from './conjugation';
import type { DeclensionFilters } from '../lib/declensionScheduler/types';

export interface UserFilters {
  conjugation: ConjugationFilters;
  declension: DeclensionFilters;
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  conjugation: {
    tenses: [],
    persons: [],
    number: 'All',
    aspects: [],
    verbClasses: [],
    genders: [],
  },
  declension: {
    cases: [],
    genders: [],
    number: 'All',
  },
};
