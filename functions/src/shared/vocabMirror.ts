export const VOCAB_EXAMPLE_TAG = 'vocab-example';
export const VOCAB_EXAMPLE_SOURCE = 'vocab-example';

export interface VocabExampleDoc {
  id?: string;
  polish?: string;
  english?: string;
}

export function mirrorSentenceIdFor(vocabId: string, exampleId: string): string {
  return `vocab-${vocabId}-${exampleId}`;
}

export function customMirrorSentenceIdFor(wordId: string, exampleId: string): string {
  return `custom_vocab-${wordId}-${exampleId}`;
}
