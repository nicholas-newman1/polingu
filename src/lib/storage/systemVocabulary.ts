import type { VocabularyWord } from '../../types/vocabulary';
import { systemContent } from './systemContent';

const vocabulary = systemContent<VocabularyWord, number>('vocabulary');

export const updateSystemVocabularyWord = vocabulary.update;
export const deleteSystemVocabularyWord = vocabulary.delete;
