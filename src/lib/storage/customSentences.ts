import { createCustomStorage } from './createCustomStorage';
import type { CustomSentence } from '../../types/sentences';

const storage = createCustomStorage<CustomSentence>('customSentences', {
  documentKey: 'sentences',
});

export const loadCustomSentences = storage.load;
export const saveCustomSentences = storage.save;
export const addCustomSentence = storage.add;
export const updateCustomSentence = storage.update;
export const deleteCustomSentence = storage.delete;
