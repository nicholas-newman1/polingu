import { db } from './firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';
import type { DeclensionCard, DeclensionCardIndex } from './types.js';
import { validateDeclensionCard } from './types.js';

const INDEX_PATH = resolve(process.cwd(), 'declensionCardIndex.json');

function loadIndex(): DeclensionCardIndex[] {
  if (!existsSync(INDEX_PATH)) {
    return [];
  }
  return JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));
}

function checkDuplicates(
  newCards: DeclensionCard[],
  existingIndex: DeclensionCardIndex[]
): { duplicateIds: number[]; duplicateFronts: string[] } {
  const existingIds = new Set(existingIndex.map((c) => c.id));
  const existingFronts = new Set(
    existingIndex.map((c) => c.front.toLowerCase())
  );

  const duplicateIds = newCards
    .filter((c) => existingIds.has(c.id))
    .map((c) => c.id);

  const duplicateFronts = newCards
    .filter((c) => existingFronts.has(c.front.toLowerCase()))
    .map((c) => c.front);

  return { duplicateIds, duplicateFronts };
}

async function importCards(filePath: string) {
  console.log(`📂 Reading ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let newCards: unknown[];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    newCards = Array.isArray(parsed) ? parsed : parsed.cards;
    if (!Array.isArray(newCards)) {
      throw new Error('Expected array or object with cards array');
    }
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`📋 Validating ${newCards.length} cards...`);

  let hasErrors = false;
  const validCards: DeclensionCard[] = [];

  for (let i = 0; i < newCards.length; i++) {
    if (validateDeclensionCard(newCards[i], i)) {
      validCards.push(newCards[i] as DeclensionCard);
    } else {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error(
      '\n❌ Validation failed. Fix the errors above and try again.'
    );
    process.exit(1);
  }

  console.log('✓ All cards validated');

  console.log('🔍 Checking for duplicates...');
  const index = loadIndex();
  const { duplicateIds, duplicateFronts } = checkDuplicates(validCards, index);

  if (duplicateIds.length > 0) {
    console.error(`❌ Duplicate IDs found: ${duplicateIds.join(', ')}`);
    hasErrors = true;
  }

  if (duplicateFronts.length > 0) {
    console.error('❌ Duplicate front prompts found:');
    duplicateFronts.forEach((f) => console.error(`   - "${f}"`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Import aborted due to duplicates.');
    process.exit(1);
  }

  console.log('✓ No duplicates found');

  console.log('📤 Writing to Firestore...');
  const BATCH_SIZE = 500;

  for (let i = 0; i < validCards.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = validCards.slice(i, i + BATCH_SIZE);

    for (const card of chunk) {
      const docRef = db.collection('declensionCards').doc(String(card.id));
      batch.set(docRef, { ...card, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();
    console.log(
      `✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Uploaded ${
        chunk.length
      } cards`
    );
  }

  console.log(`✓ Added ${validCards.length} cards to Firestore`);

  const newIndex: DeclensionCardIndex[] = [
    ...index,
    ...validCards.map((c) => ({
      id: c.id,
      front: c.front,
      case: c.case,
      gender: c.gender,
      number: c.number,
    })),
  ].sort((a, b) => a.id - b.id);

  writeFileSync(INDEX_PATH, JSON.stringify(newIndex, null, 2));
  console.log('✓ Updated declensionCardIndex.json');

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
  console.error('Usage: npm run declension:import <file.json>');
  console.error('Example: npm run declension:import new-declension.json');
  process.exit(1);
}

importCards(resolve(process.cwd(), filePath)).catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
