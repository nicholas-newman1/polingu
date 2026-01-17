import type { DeclensionCard } from '../../types';
import type { DeclensionFilters } from './types';

export default function matchesDeclensionFilters(card: DeclensionCard, filters: DeclensionFilters): boolean {
  if (filters.case !== 'All' && card.case !== filters.case) return false;
  if (filters.gender !== 'All' && card.gender !== filters.gender) return false;
  if (filters.number !== 'All' && card.number !== filters.number) return false;
  return true;
}

