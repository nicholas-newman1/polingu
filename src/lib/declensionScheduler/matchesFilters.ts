import type { DeclensionCard } from '../../types';
import type { DeclensionFilters } from './types';

export default function matchesDeclensionFilters(
  card: DeclensionCard,
  filters: DeclensionFilters
): boolean {
  if (filters.cases.length > 0 && !filters.cases.includes(card.case)) return false;
  if (filters.genders.length > 0 && !filters.genders.includes(card.gender)) return false;
  if (filters.number !== 'All' && card.number !== filters.number) return false;
  return true;
}
