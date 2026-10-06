import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { ImportedVerb, VerbIndex } from './verb-types.js';
import { validateVerb } from './verb-types.js';
import {
  abortOnDuplicates,
  abortOnValidationErrors,
  loadJsonIndex,
  readImportFile,
  removeImportFiles,
  runImportCli,
  writeInBatches,
} from './lib/importHelpers.js';

const INDEX_PATH = resolve(process.cwd(), 'verbIndex.json');

function checkDuplicates(
  newVerbs: ImportedVerb[],
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
  const newVerbs = readImportFile(filePath, 'verbs');

  console.log(`📋 Validating ${newVerbs.length} verbs...`);

  const verbMap = new Map<string, unknown>();
  for (const verb of newVerbs) {
    const v = verb as Record<string, unknown>;
    if (typeof v.id === 'string') {
      verbMap.set(v.id, verb);
    }
  }

  let hasErrors = false;
  const validVerbs: ImportedVerb[] = [];

  for (const verb of newVerbs) {
    const errors = validateVerb(verb, verbMap);
    if (errors.length > 0) {
      hasErrors = true;
      console.error('\n❌ Verb validation errors:');
      errors.forEach((e) => console.error(`   - ${e}`));
    } else {
      validVerbs.push(verb as ImportedVerb);
    }
  }

  abortOnValidationErrors(hasErrors, 'verbs');

  console.log('🔍 Checking for duplicates...');
  const index = loadJsonIndex<VerbIndex>(INDEX_PATH);
  const { duplicateIds, duplicateInfinitives } = checkDuplicates(validVerbs, index);
  abortOnDuplicates(duplicateIds, duplicateInfinitives, 'infinitives');

  await writeInBatches('verbs', validVerbs, (verb) => verb.id, 'verbs');

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

  removeImportFiles(filePath);

  console.log('\n✅ Import complete!');
}

runImportCli('verbs:import', 'new-verbs.json', importVerbs);
