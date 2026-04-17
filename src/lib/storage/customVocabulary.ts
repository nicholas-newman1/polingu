import { createCustomCollectionStorage } from './createCustomCollectionStorage';
import type { CustomVocabularyWord } from '../../types/vocabulary';

const storage = createCustomCollectionStorage<CustomVocabularyWord>('customVocabulary');

export const loadCustomVocabulary = storage.load;
export const saveCustomVocabulary = storage.save;
export const subscribeCustomVocabulary = storage.subscribe;
