import { useTranslatableTextActions } from './useTranslatableTextActions';
import { useTranslatableTextUI } from './useTranslatableTextUI';
import type { TranslatableTextContextValue } from '../contexts/TranslatableTextContext';

/** @deprecated Prefer useTranslatableTextActions or useTranslatableTextUI */
export function useTranslatableText(): TranslatableTextContextValue | null {
  const actions = useTranslatableTextActions();
  const ui = useTranslatableTextUI();

  if (!actions) return null;

  const interaction = actions.getInteractionState();

  return {
    ...actions,
    ...ui,
    isDragging: interaction.isDragging,
    phraseAnchorEl: ui?.phraseAnchorEl ?? null,
    selectedPhrase: ui?.selectedPhrase ?? null,
    activeWord: ui?.activeWord ?? null,
  };
}
