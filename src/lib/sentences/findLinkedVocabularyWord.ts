import type { Sentence } from '../../types/sentences';
import type { VocabularyWord } from '../../types/vocabulary';

export function findLinkedVocabularyWord(
  sentence: Sentence | null | undefined,
  vocabularyWords: VocabularyWord[]
): VocabularyWord | undefined {
  if (!sentence || sentence.source !== 'vocab-example' || !sentence.sourceVocabularyId) {
    return undefined;
  }

  const vocabId = String(sentence.sourceVocabularyId);
  return vocabularyWords.find((word) => String(word.id) === vocabId);
}
