import type { VocabularyWord } from '../../types/vocabulary';

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function normalizeCustomVocabularyFields<
  W extends Pick<VocabularyWord, 'polish' | 'english'>,
>(word: W): W {
  return {
    ...word,
    polish: normalizeText(word.polish),
    english: normalizeText(word.english),
  };
}
