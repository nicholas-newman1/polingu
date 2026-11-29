import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomSentence } from '../../types/sentences';

export const customSentenceStorage =
  createCustomCollectionStorage<CustomSentence>('customSentences');

export const loadCustomSentences = customSentenceStorage.load;
export const subscribeCustomSentences = customSentenceStorage.subscribe;
