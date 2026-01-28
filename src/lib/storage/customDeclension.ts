import { createCustomStorage } from './createCustomStorage';
import type { CustomDeclensionCard } from '../../types';

const storage = createCustomStorage<CustomDeclensionCard>('customDeclension');

export const loadCustomDeclension = storage.load;
export const saveCustomDeclension = storage.save;
export const addCustomDeclensionCard = storage.add;
export const updateCustomDeclensionCard = storage.update;
export const deleteCustomDeclensionCard = storage.delete;
