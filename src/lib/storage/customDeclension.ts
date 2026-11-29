import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomDeclensionCard } from '../../types';

export const customDeclensionStorage =
  createCustomCollectionStorage<CustomDeclensionCard>('customDeclension');

export const loadCustomDeclension = customDeclensionStorage.load;
export const subscribeCustomDeclension = customDeclensionStorage.subscribe;
