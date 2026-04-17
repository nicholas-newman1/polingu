import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomDeclensionCard } from '../../types';

const storage = createCustomCollectionStorage<CustomDeclensionCard>('customDeclension');

export const loadCustomDeclension = storage.load;
export const saveCustomDeclension = storage.save;
export const subscribeCustomDeclension = storage.subscribe;
