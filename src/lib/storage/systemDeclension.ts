import type { DeclensionCard } from '../../types';
import { systemContent } from './systemContent';

const declensionCards = systemContent<DeclensionCard, number>('declensionCards');

export const updateDeclensionCard = declensionCards.update;
export const deleteDeclensionCard = declensionCards.delete;
export const updateDeclensionCardTranslation = declensionCards.updateTranslation;
