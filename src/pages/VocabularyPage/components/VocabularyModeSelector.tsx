import { ModeSelector } from '../../../components/ModeSelector';
import type { DeckStats } from '../../../components/ModeSelector';
import type { TranslationDirection } from '../../../types/common';

interface VocabularyModeSelectorProps {
  stats: Record<TranslationDirection, DeckStats>;
  loading?: boolean;
  onSelectMode: (direction: TranslationDirection) => void;
}

export function VocabularyModeSelector({
  stats,
  loading,
  onSelectMode,
}: VocabularyModeSelectorProps) {
  return <ModeSelector stats={stats} loading={loading} onSelectMode={onSelectMode} />;
}
