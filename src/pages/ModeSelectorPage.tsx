import { useNavigate } from 'react-router-dom';
import { ModeSelector } from '../components/ModeSelector';
import { SentenceLevelStats } from './SentencesPage/components/SentenceLevelStats';
import { DIRECTION_ROUTES, toModeStats } from '../lib/reviewSession/directions';
import { useProgressStats } from '../hooks/useProgressStats';
import { useReviewDataLoading } from '../hooks/useReviewData';

interface ModeSelectorPageProps {
  /** The deck, which is also its route: /vocabulary, /sentences or /conjugation. */
  deck: 'vocabulary' | 'sentences' | 'conjugation';
}

/** Where a deck studied in both directions starts: a choice of recognition or production. */
export function ModeSelectorPage({ deck }: ModeSelectorPageProps) {
  const navigate = useNavigate();
  const loading = useReviewDataLoading();
  const stats = useProgressStats();
  const sentences = stats.sentencesByDirection;

  return (
    <ModeSelector
      stats={toModeStats(
        deck === 'sentences'
          ? { 'pl-to-en': sentences['pl-to-en'].total, 'en-to-pl': sentences['en-to-pl'].total }
          : stats[`${deck}ByDirection`]
      )}
      loading={loading}
      onSelectMode={(direction) => navigate(`/${deck}/${DIRECTION_ROUTES[direction].route}`)}
      renderStats={
        deck === 'sentences'
          ? (direction) => <SentenceLevelStats stats={sentences[direction]} />
          : undefined
      }
    />
  );
}
