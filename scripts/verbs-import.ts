import { db } from './firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import type { Verb, VerbIndex } from './verb-types.js';
import { validateVerb } from './verb-types.js';

const INDEX_PATH = resolve(process.cwd(), 'verbIndex.json');

function loadIndex(): VerbIndex[] {
  if (!existsSync(INDEX_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
}

function checkDuplicates(
  newVerbs: Verb[],
  existingIndex: VerbIndex[]
): { duplicateIds: string[]; duplicateInfinitives: string[] } {
  const existingIds = new Set(existingIndex.map((v) => v.id));
  const existingInfinitives = new Set(existingIndex.map((v) => v.infinitive.toLowerCase()));

  const duplicateIds = newVerbs.filter((v) => existingIds.has(v.id)).map((v) => v.id);

  const duplicateInfinitives = newVerbs
    .filter((v) => existingInfinitives.has(v.infinitive.toLowerCase()))
    .map((v) => v.infinitive);

  return { duplicateIds, duplicateInfinitives };
}

async function importVerbs(filePath: string) {
  console.log(`📂 Reading ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let newVerbs: unknown[];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    newVerbs = Array.isArray(parsed) ? parsed : parsed.verbs;
    if (!Array.isArray(newVerbs)) {
      throw new Error('Expected array or object with verbs array');
    }
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`📋 Validating ${newVerbs.length} verbs...`);

  const verbMap = new Map<string, unknown>();
  for (const verb of newVerbs) {
    const v = verb as Record<string, unknown>;
    if (typeof v.id === 'string') {
      verbMap.set(v.id, verb);
    }
  }

  let hasErrors = false;
  const validVerbs: Verb[] = [];

  for (const verb of newVerbs) {
    const errors = validateVerb(verb, verbMap);
    if (errors.length > 0) {
      hasErrors = true;
      console.error('\n❌ Verb validation errors:');
      errors.forEach((e) => console.error(`   - ${e}`));
    } else {
      validVerbs.push(verb as Verb);
    }
  }

  if (hasErrors) {
    console.error('\n❌ Validation failed. Fix the errors above and try again.');
    process.exit(1);
  }

  console.log('✓ All verbs validated');

  console.log('🔍 Checking for duplicates...');
  const index = loadIndex();
  const { duplicateIds, duplicateInfinitives } = checkDuplicates(validVerbs, index);

  if (duplicateIds.length > 0) {
    console.error(`❌ Duplicate IDs found: ${duplicateIds.join(', ')}`);
    hasErrors = true;
  }

  if (duplicateInfinitives.length > 0) {
    console.error('❌ Duplicate infinitives found:');
    duplicateInfinitives.forEach((inf) => console.error(`   - "${inf}"`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Import aborted due to duplicates.');
    process.exit(1);
  }

  console.log('✓ No duplicates found');

  console.log('📤 Writing to Firestore...');
  const BATCH_SIZE = 500;

  for (let i = 0; i < validVerbs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = validVerbs.slice(i, i + BATCH_SIZE);

    for (const verb of chunk) {
      const docRef = db.collection('verbs').doc(verb.id);
      batch.set(docRef, { ...verb, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();
    console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Uploaded ${chunk.length} verbs`);
  }

  console.log(`✓ Added ${validVerbs.length} verbs to Firestore`);

  const newIndex: VerbIndex[] = [
    ...index,
    ...validVerbs.map((v) => ({
      id: v.id,
      infinitive: v.infinitive,
      aspect: v.aspect,
      verbClass: v.verbClass,
    })),
  ].sort((a, b) => a.infinitive.localeCompare(b.infinitive, 'pl'));

  writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));
  console.log('✓ Updated verbIndex.json');

  unlinkSync(filePath);
  console.log(`✓ Deleted ${basename(filePath)}`);

  const reviewFileName = basename(filePath, '.json') + '-review.json';
  const reviewFilePath = resolve(process.cwd(), reviewFileName);
  if (existsSync(reviewFilePath)) {
    unlinkSync(reviewFilePath);
    console.log(`✓ Deleted ${reviewFileName}`);
  }

  console.log('\n✅ Import complete!');
}

const [, , filePath] = process.argv;

if (!filePath) {
  console.error('Usage: npm run verbs:import <file.json>');
  console.error('Example: npm run verbs:import new-verbs.json');
  process.exit(1);
}

importVerbs(resolve(process.cwd(), filePath)).catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
