import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DeclensionCard, DeclensionCardIndex } from './types.js';
import { validateDeclensionCard } from './types.js';
import {
  abortOnDuplicates,
  abortOnValidationErrors,
  loadJsonIndex,
  readImportFile,
  removeImportFiles,
  runImportCli,
  writeInBatches,
} from './lib/importHelpers.js';

const INDEX_PATH = resolve(process.cwd(), 'declensionCardIndex.json');

function checkDuplicates(
  newCards: DeclensionCard[],
  existingIndex: DeclensionCardIndex[]
): { duplicateIds: number[]; duplicateFronts: string[] } {
  const existingIds = new Set(existingIndex.map((c) => c.id));
  const existingFronts = new Set(existingIndex.map((c) => c.front.toLowerCase()));

  const duplicateIds = newCards.filter((c) => existingIds.has(c.id)).map((c) => c.id);

  const duplicateFronts = newCards
    .filter((c) => existingFronts.has(c.front.toLowerCase()))
    .map((c) => c.front);

  return { duplicateIds, duplicateFronts };
}

async function importCards(filePath: string) {
  const newCards = readImportFile(filePath, 'cards');

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

  abortOnValidationErrors(hasErrors, 'cards');

  console.log('🔍 Checking for duplicates...');
  const index = loadJsonIndex<DeclensionCardIndex>(INDEX_PATH);
  const { duplicateIds, duplicateFronts } = checkDuplicates(validCards, index);
  abortOnDuplicates(duplicateIds, duplicateFronts, 'front prompts');

  await writeInBatches('declensionCards', validCards, (card) => String(card.id), 'cards');

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

  removeImportFiles(filePath);

  console.log('\n✅ Import complete!');
}

runImportCli('declension:import', 'new-declension.json', importCards);
