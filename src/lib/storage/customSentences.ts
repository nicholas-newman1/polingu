import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomSentence } from '../../types/sentences';

const storage = createCustomCollectionStorage<CustomSentence>('customSentences');

export const loadCustomSentences = storage.load;
export const saveCustomSentences = storage.save;
export const subscribeCustomSentences = storage.subscribe;
