import { ModeSelector } from '../../../components/ModeSelector';
import type { DeckStats } from '../../../components/ModeSelector';
import type { TranslationDirection } from '../../../types/common';

interface ConjugationModeSelectorProps {
  stats: Record<TranslationDirection, DeckStats>;
  loading?: boolean;
  onSelectMode: (direction: TranslationDirection) => void;
}

export function ConjugationModeSelector({
  stats,
  loading,
  onSelectMode,
}: ConjugationModeSelectorProps) {
  return <ModeSelector stats={stats} loading={loading} onSelectMode={onSelectMode} />;
}
