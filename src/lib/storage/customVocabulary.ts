import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomVocabularyWord } from '../../types/vocabulary';
import { normalizeCustomVocabularyFields } from '../utils/normalizeCustomVocabularyFields';

export const customVocabularyStorage = createCustomCollectionStorage<CustomVocabularyWord>(
  'customVocabulary',
  normalizeCustomVocabularyFields
);

export const loadCustomVocabulary = customVocabularyStorage.load;
export const subscribeCustomVocabulary = customVocabularyStorage.subscribe;
