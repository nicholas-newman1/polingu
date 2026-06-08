import type { CustomVocabularyWord } from '../../types/vocabulary';

export type CustomVocabularyWordInput = Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>;

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function normalizeCustomVocabularyFields(
  word: CustomVocabularyWordInput
): CustomVocabularyWordInput {
  return {
    ...word,
    polish: normalizeText(word.polish),
    english: normalizeText(word.english),
  };
}

export function normalizeCustomVocabularyWord(word: CustomVocabularyWord): CustomVocabularyWord {
  return {
    ...word,
    polish: normalizeText(word.polish),
    english: normalizeText(word.english),
  };
}
