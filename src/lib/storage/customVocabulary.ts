import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomVocabularyWord } from '../../types/vocabulary';
import { normalizeCustomVocabularyWord } from '../utils/normalizeCustomVocabularyFields';

const storage = createCustomCollectionStorage<CustomVocabularyWord>('customVocabulary');

export const loadCustomVocabulary = storage.load;
export const saveCustomVocabulary = (items: CustomVocabularyWord[]) =>
  storage.save(items.map(normalizeCustomVocabularyWord));
export const subscribeCustomVocabulary = storage.subscribe;
