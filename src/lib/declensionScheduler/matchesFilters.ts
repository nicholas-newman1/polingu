import type { Card } from '../../types';
import type { Filters } from './types';

export default function matchesFilters(card: Card, filters: Filters): boolean {
  if (filters.case !== 'All' && card.case !== filters.case) return false;
  if (filters.gender !== 'All' && card.gender !== filters.gender) return false;
  if (filters.number !== 'All' && card.number !== filters.number) return false;
  return true;
}

