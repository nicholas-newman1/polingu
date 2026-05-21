import {
  Abc,
  School,
  Translate,
  AutoStories,
  CompareArrows,
  MusicNote,
  MenuBook,
  Headphones,
} from '@mui/icons-material';
import type { ReviewCounts } from '../contexts/review';

type ColorKey = 'primary' | 'info' | 'success' | 'warning' | 'secondary' | 'error';

export interface FeatureNavItem {
  path: string;
  icon: typeof School;
  label: string;
  description: string;
  fullDescription: string;
  colorKey: ColorKey;
  statsKey: keyof ReviewCounts;
}

/**
 * Shared navigation items for features that appear in both
 * the sidebar navigation and dashboard cards.
 * Order here determines display order in both places.
 */
export const FEATURE_NAV_ITEMS: FeatureNavItem[] = [
  {
    path: '/vocabulary',
    icon: Abc,
    label: 'Vocabulary',
    description: 'Top 1000 Polish words',
    fullDescription: 'Learn the top 1000 most common Polish words with example sentences',
    colorKey: 'info',
    statsKey: 'vocabulary',
  },
  {
    path: '/declension',
    icon: School,
    label: 'Declension',
    description: 'Drill noun declensions',
    fullDescription: 'Drill noun and pronoun declensions with spaced repetition flashcards',
    colorKey: 'primary',
    statsKey: 'declension',
  },
  {
    path: '/conjugation',
    icon: AutoStories,
    label: 'Conjugation',
    description: 'Verb conjugations',
    fullDescription: 'Master Polish verb conjugations across all tenses and persons',
    colorKey: 'warning',
    statsKey: 'conjugation',
  },
  {
    path: '/sentences',
    icon: Translate,
    label: 'Sentences',
    description: 'Translate full sentences',
    fullDescription: 'Translate full sentences and drill with spaced repetition',
    colorKey: 'success',
    statsKey: 'sentences',
  },
  {
    path: '/aspect-pairs',
    icon: CompareArrows,
    label: 'Aspect Pairs',
    description: 'Perfective / imperfective pairs',
    fullDescription: 'Drill verb aspects and their pairs',
    colorKey: 'secondary',
    statsKey: 'aspectPairs',
  },
];

export interface ExtraNavItem {
  path: string;
  icon: typeof School;
  label: string;
  description: string;
  fullDescription: string;
  colorKey: ColorKey;
}

export const EXTRA_NAV_ITEMS: ExtraNavItem[] = [
  {
    path: '/consonant-driller',
    icon: MusicNote,
    label: 'Consonant Driller',
    description: 'Hard/soft consonants',
    fullDescription: 'Drill hard and soft Polish consonants',
    colorKey: 'error',
  },
  {
    path: '/library',
    icon: MenuBook,
    label: 'Library',
    description: 'Read books & PDFs',
    fullDescription: 'Read Polish books and PDFs with built-in translation tools',
    colorKey: 'warning',
  },
  {
    path: '/audio',
    icon: Headphones,
    label: 'Audio',
    description: 'Listen & learn',
    fullDescription: 'Listen to Polish audio content and drill comprehension',
    colorKey: 'info',
  },
  {
    path: '/listen',
    icon: Headphones,
    label: 'Listening',
    description: 'Passive audio drill',
    fullDescription: 'Passively listen to sentences, vocabulary, or declensions for reinforcement',
    colorKey: 'success',
  },
];

export type DashboardNavItem =
  | (FeatureNavItem & { kind: 'feature' })
  | (ExtraNavItem & { kind: 'extra' });

export const ALL_DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  ...FEATURE_NAV_ITEMS.map((item) => ({ ...item, kind: 'feature' as const })),
  ...EXTRA_NAV_ITEMS.map((item) => ({ ...item, kind: 'extra' as const })),
];

/**
 * Merge a user's stored dashboard order with the canonical item list.
 * - Items in `storedOrder` that no longer exist are dropped.
 * - Items that exist but are missing from `storedOrder` are appended at the
 *   end so newly shipped features remain discoverable for existing users.
 */
export function getOrderedDashboardItems(storedOrder?: string[]): DashboardNavItem[] {
  if (!storedOrder || storedOrder.length === 0) {
    return ALL_DASHBOARD_NAV_ITEMS;
  }

  const byPath = new Map(ALL_DASHBOARD_NAV_ITEMS.map((item) => [item.path, item]));
  const ordered: DashboardNavItem[] = [];
  const seen = new Set<string>();

  for (const path of storedOrder) {
    const item = byPath.get(path);
    if (item && !seen.has(path)) {
      ordered.push(item);
      seen.add(path);
    }
  }

  for (const item of ALL_DASHBOARD_NAV_ITEMS) {
    if (!seen.has(item.path)) {
      ordered.push(item);
    }
  }

  return ordered;
}
