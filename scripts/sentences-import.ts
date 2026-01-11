import { db } from './firebase-admin.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Sentence, SentenceIndex } from './types.js';
import { validateSentence } from './types.js';

const INDEX_PATH = resolve(process.cwd(), 'sentenceIndex.json');

function loadIndex(): SentenceIndex[] {
  if (!existsSync(INDEX_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
}

function checkDuplicates(
  newSentences: Sentence[],
  existingIndex: SentenceIndex[]
): { duplicateIds: string[]; duplicatePolish: string[] } {
  const existingIds = new Set(existingIndex.map((s) => s.id));
  const existingPolish = new Set(existingIndex.map((s) => s.polish.toLowerCase()));

  const duplicateIds = newSentences
    .filter((s) => existingIds.has(s.id))
    .map((s) => s.id);

  const duplicatePolish = newSentences
    .filter((s) => existingPolish.has(s.polish.toLowerCase()))
    .map((s) => s.polish);

  return { duplicateIds, duplicatePolish };
}

async function importSentences(filePath: string) {
  console.log(`📂 Reading ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let newSentences: unknown[];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    newSentences = Array.isArray(parsed) ? parsed : parsed.sentences;
    if (!Array.isArray(newSentences)) {
      throw new Error('Expected array or object with sentences array');
    }
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`📋 Validating ${newSentences.length} sentences...`);

  let hasErrors = false;
  const validSentences: Sentence[] = [];

  for (let i = 0; i < newSentences.length; i++) {
    if (validateSentence(newSentences[i], i)) {
      validSentences.push(newSentences[i] as Sentence);
    } else {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n❌ Validation failed. Fix the errors above and try again.');
    process.exit(1);
  }

  console.log('✓ All sentences validated');

  console.log('🔍 Checking for duplicates...');
  const index = loadIndex();
  const { duplicateIds, duplicatePolish } = checkDuplicates(validSentences, index);

  if (duplicateIds.length > 0) {
    console.error(`❌ Duplicate IDs found: ${duplicateIds.join(', ')}`);
    hasErrors = true;
  }

  if (duplicatePolish.length > 0) {
    console.error('❌ Duplicate Polish sentences found:');
    duplicatePolish.forEach((p) => console.error(`   - "${p}"`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Import aborted due to duplicates.');
    process.exit(1);
  }

  console.log('✓ No duplicates found');

  console.log('📤 Writing to Firestore...');
  const batch = db.batch();

  for (const sentence of validSentences) {
    const docRef = db.collection('sentences').doc(sentence.id);
    batch.set(docRef, sentence);
  }

  await batch.commit();
  console.log(`✓ Added ${validSentences.length} sentences to Firestore`);

  const newIndex: SentenceIndex[] = [
    ...index,
    ...validSentences.map((s) => ({
      id: s.id,
      polish: s.polish,
      level: s.level,
      tags: s.tags,
    })),
  ].sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));
  console.log('✓ Updated sentenceIndex.json');

  console.log('\n✅ Import complete!');
}

const [, , filePath] = process.argv;

if (!filePath) {
  console.error('Usage: npm run sentences:import <file.json>');
  console.error('Example: npm run sentences:import new-sentences.json');
  process.exit(1);
}

importSentences(resolve(process.cwd(), filePath)).catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});

