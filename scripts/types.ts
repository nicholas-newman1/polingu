export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface WordAnnotation {
  word: string;
  lemma: string;
  english: string;
  grammar?: string;
  notes?: string;
}

export interface Sentence {
  id: string;
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
  words: WordAnnotation[];
}

export interface SentenceIndex {
  id: string;
  polish: string;
  level: CEFRLevel;
  tags: string[];
}

export const VALID_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function isValidLevel(level: string): level is CEFRLevel {
  return VALID_LEVELS.includes(level as CEFRLevel);
}

export function validateSentence(sentence: unknown, index: number): sentence is Sentence {
  const s = sentence as Record<string, unknown>;
  const errors: string[] = [];

  if (!s.id || typeof s.id !== 'string') {
    errors.push('missing or invalid "id"');
  }
  if (!s.polish || typeof s.polish !== 'string') {
    errors.push('missing or invalid "polish"');
  }
  if (!s.english || typeof s.english !== 'string') {
    errors.push('missing or invalid "english"');
  }
  if (!s.level || !isValidLevel(s.level as string)) {
    errors.push(`invalid "level" (must be one of: ${VALID_LEVELS.join(', ')})`);
  }
  if (!Array.isArray(s.tags)) {
    errors.push('missing or invalid "tags" (must be array)');
  }
  if (!Array.isArray(s.words)) {
    errors.push('missing or invalid "words" (must be array)');
  } else {
    (s.words as unknown[]).forEach((w, i) => {
      const word = w as Record<string, unknown>;
      if (!word.word || !word.lemma || !word.english) {
        errors.push(`words[${i}] missing required fields (word, lemma, english)`);
      }
    });
  }

  if (errors.length > 0) {
    console.error(`❌ Sentence at index ${index} has errors:`);
    errors.forEach((e) => console.error(`   - ${e}`));
    return false;
  }

  return true;
}

