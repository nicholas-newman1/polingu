import type { VocabularyWord, VocabularyWordId } from '../../types/vocabulary';
import { normalizeVocabularyPrefill } from './normalizeVocabularyPrefill';

/** The word in `words` whose Polish matches `polish`, ignoring case and stray spacing. */
export function findWordWithSamePolish<W extends Pick<VocabularyWord, 'id' | 'polish'>>(
  words: W[],
  polish: string,
  excludeId?: VocabularyWordId
): W | undefined {
  const key = normalizeVocabularyPrefill(polish);
  if (!key) return undefined;
  return words.find((w) => w.id !== excludeId && normalizeVocabularyPrefill(w.polish) === key);
}
