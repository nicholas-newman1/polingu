import type { CustomVocabularyWord, VocabularyWordId } from '../../types/vocabulary';
import { normalizeVocabularyPrefill } from './normalizeVocabularyPrefill';

export function findCustomWordWithSamePolish(
  words: CustomVocabularyWord[],
  polish: string,
  excludeId?: VocabularyWordId
): CustomVocabularyWord | undefined {
  const key = normalizeVocabularyPrefill(polish);
  if (!key) return undefined;
  return words.find((w) => w.id !== excludeId && normalizeVocabularyPrefill(w.polish) === key);
}
