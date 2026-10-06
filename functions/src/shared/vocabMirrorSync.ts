import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
} from 'firebase-admin/firestore';
import { db } from './firebase.js';
import { openaiApiKey } from './secrets.js';
import { CEFRLevel, assessSentenceCEFR } from './cefr.js';
import { VOCAB_EXAMPLE_SOURCE, VOCAB_EXAMPLE_TAG, VocabExampleDoc } from './vocabMirror.js';

const trimmed = (value: unknown): string => ((value as string | undefined) ?? '').trim();

function examplesById(doc: DocumentData | undefined): Map<string, VocabExampleDoc> {
  const byId = new Map<string, VocabExampleDoc>();
  for (const ex of (doc?.examples ?? []) as VocabExampleDoc[]) {
    if (ex.id) byId.set(ex.id, ex);
  }
  return byId;
}

interface MirrorSentencesTarget {
  wordId: string;
  sentences: CollectionReference;
  mirrorIdFor: (wordId: string, exampleId: string) => string;
  /** Used in log lines, e.g. "mirror sentence sentences/abc". */
  describe: (sentenceId: string) => string;
  /** Prefix for the warning logged when a mirror can't be created. */
  logPrefix: string;
  /** Fields added to newly created mirror sentences. */
  createFields: () => Record<string, unknown>;
}

async function deleteMirror(target: MirrorSentencesTarget, exampleId: string): Promise<void> {
  const sentenceId = target.mirrorIdFor(target.wordId, exampleId);
  try {
    await target.sentences.doc(sentenceId).delete();
  } catch (error) {
    console.error(`Failed to delete ${target.describe(sentenceId)}:`, error);
  }
}

async function assessLevel(polish: string): Promise<CEFRLevel | null> {
  const apiKey = openaiApiKey.value();
  return apiKey ? assessSentenceCEFR(polish, apiKey) : null;
}

async function createMirror(
  target: MirrorSentencesTarget,
  sentenceRef: DocumentReference,
  exampleId: string,
  fields: { polish: string; english: string }
): Promise<void> {
  const level = await assessLevel(fields.polish);
  if (!level) {
    console.warn(`${target.logPrefix} example ${exampleId} - skipping mirror sentence creation`);
    return;
  }

  try {
    await sentenceRef.set({
      id: sentenceRef.id,
      ...target.createFields(),
      ...fields,
      level,
      tags: [VOCAB_EXAMPLE_TAG],
      source: VOCAB_EXAMPLE_SOURCE,
      sourceVocabularyId: target.wordId,
      sourceExampleId: exampleId,
    });
    console.log(`Created ${target.describe(sentenceRef.id)}`);
  } catch (error) {
    console.error(`Failed to create ${target.describe(sentenceRef.id)}:`, error);
  }
}

async function upsertMirror(
  target: MirrorSentencesTarget,
  exampleId: string,
  example: VocabExampleDoc,
  previous: VocabExampleDoc | undefined
): Promise<void> {
  const polish = trimmed(example.polish);
  const english = trimmed(example.english);
  if (!polish || !english) return;

  const beforePolish = trimmed(previous?.polish);
  if (previous && beforePolish === polish && trimmed(previous.english) === english) return;

  const sentenceRef = target.sentences.doc(target.mirrorIdFor(target.wordId, exampleId));
  const existing = (await sentenceRef.get()).data();

  if (!existing) {
    await createMirror(target, sentenceRef, exampleId, { polish, english });
    return;
  }
  if ((existing.polish ?? '') === polish && (existing.english ?? '') === english) return;

  const updates: Record<string, unknown> = { polish, english };
  if (beforePolish !== polish) {
    const level = await assessLevel(polish);
    if (level) updates.level = level;
  }
  try {
    await sentenceRef.update(updates);
  } catch (error) {
    console.error(`Failed to update ${target.describe(sentenceRef.id)}:`, error);
  }
}

/**
 * Keeps one mirror sentence per vocabulary example: deletes mirrors for removed examples
 * and creates or updates mirrors for added or edited ones.
 */
export async function syncMirrorSentences(
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  target: MirrorSentencesTarget
): Promise<void> {
  const beforeById = examplesById(before);
  const afterById = examplesById(after);

  for (const exampleId of beforeById.keys()) {
    if (!afterById.has(exampleId)) await deleteMirror(target, exampleId);
  }

  for (const [exampleId, example] of afterById) {
    await upsertMirror(target, exampleId, example, beforeById.get(exampleId));
  }
}

interface VocabLinkTarget {
  vocabulary: CollectionReference;
  /** Used in log lines, e.g. "vocabulary/abc". */
  describe: (vocabId: string) => string;
}

function getVocabLink(doc: DocumentData): { vocabId: string; exampleId: string } | null {
  if (doc.source !== VOCAB_EXAMPLE_SOURCE) return null;
  const vocabId = doc.sourceVocabularyId as string | undefined;
  const exampleId = doc.sourceExampleId as string | undefined;
  return vocabId && exampleId ? { vocabId, exampleId } : null;
}

function updateExamples(
  vocabRef: DocumentReference,
  change: (examples: VocabExampleDoc[]) => VocabExampleDoc[] | null
): Promise<void> {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(vocabRef);
    if (!snap.exists) return;
    const next = change((snap.data()!.examples ?? []) as VocabExampleDoc[]);
    if (next) tx.update(vocabRef, { examples: next });
  });
}

async function removeLinkedExample(target: VocabLinkTarget, before: DocumentData): Promise<void> {
  const link = getVocabLink(before);
  if (!link) return;

  try {
    await updateExamples(target.vocabulary.doc(link.vocabId), (examples) => {
      const filtered = examples.filter((ex) => ex.id !== link.exampleId);
      return filtered.length === examples.length ? null : filtered;
    });
  } catch (error) {
    console.error(
      `Failed to remove vocab example ${target.describe(link.vocabId)}/${link.exampleId} after sentence delete:`,
      error
    );
  }
}

async function propagateSentenceEdit(
  target: VocabLinkTarget,
  before: DocumentData | undefined,
  after: DocumentData
): Promise<void> {
  const link = getVocabLink(after);
  if (!link) return;

  const polish = trimmed(after.polish);
  const english = trimmed(after.english);
  if (!polish || !english) return;
  if (before && trimmed(before.polish) === polish && trimmed(before.english) === english) return;

  try {
    await updateExamples(target.vocabulary.doc(link.vocabId), (examples) => {
      const idx = examples.findIndex((ex) => ex.id === link.exampleId);
      if (idx === -1) return null;
      const current = examples[idx];
      if (trimmed(current.polish) === polish && trimmed(current.english) === english) return null;
      const next = [...examples];
      next[idx] = { ...current, polish, english };
      return next;
    });
  } catch (error) {
    console.error(
      `Failed to propagate sentence edit back to ${target.describe(link.vocabId)} example ${link.exampleId}:`,
      error
    );
  }
}

/** Mirrors edits or deletion of a vocab-example sentence back onto its source example. */
export async function syncVocabExampleLink(
  before: DocumentData | undefined,
  after: DocumentData | undefined,
  target: VocabLinkTarget
): Promise<void> {
  if (!after) {
    if (before) await removeLinkedExample(target, before);
    return;
  }
  await propagateSentenceEdit(target, before, after);
}
