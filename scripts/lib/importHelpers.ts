import { db } from '../firebase-admin.js';
import { FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { resolve, basename } from 'path';

const BATCH_SIZE = 500;

export function loadJsonIndex<T>(indexPath: string): T[] {
  if (!existsSync(indexPath)) {
    return [];
  }
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

/** Reads an import file that is either a bare array or an object wrapping one under `key`. */
export function readImportFile(filePath: string, key: string): unknown[] {
  console.log(`📂 Reading ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
    const items = Array.isArray(parsed) ? parsed : parsed[key];
    if (!Array.isArray(items)) {
      throw new Error(`Expected array or object with ${key} array`);
    }
    return items;
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${(err as Error).message}`);
    process.exit(1);
  }
}

export function abortOnValidationErrors(hasErrors: boolean, noun: string): void {
  if (hasErrors) {
    console.error('\n❌ Validation failed. Fix the errors above and try again.');
    process.exit(1);
  }
  console.log(`✓ All ${noun} validated`);
}

export function abortOnDuplicates(
  duplicateIds: (string | number)[],
  duplicateNames: string[],
  nameLabel: string
): void {
  let hasErrors = false;

  if (duplicateIds.length > 0) {
    console.error(`❌ Duplicate IDs found: ${duplicateIds.join(', ')}`);
    hasErrors = true;
  }

  if (duplicateNames.length > 0) {
    console.error(`❌ Duplicate ${nameLabel} found:`);
    duplicateNames.forEach((name) => console.error(`   - "${name}"`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Import aborted due to duplicates.');
    process.exit(1);
  }

  console.log('✓ No duplicates found');
}

export async function writeInBatches<T extends object>(
  collection: string,
  items: T[],
  getId: (item: T) => string,
  noun: string
): Promise<void> {
  console.log('📤 Writing to Firestore...');

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = items.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const docRef = db.collection(collection).doc(getId(item));
      batch.set(docRef, { ...item, createdAt: FieldValue.serverTimestamp() });
    }

    await batch.commit();
    console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Uploaded ${chunk.length} ${noun}`);
  }

  console.log(`✓ Added ${items.length} ${noun} to Firestore`);
}

/** Deletes the imported file and its `-review.json` companion, if any. */
export function removeImportFiles(filePath: string): void {
  unlinkSync(filePath);
  console.log(`✓ Deleted ${basename(filePath)}`);

  const reviewFileName = basename(filePath, '.json') + '-review.json';
  const reviewFilePath = resolve(process.cwd(), reviewFileName);
  if (existsSync(reviewFilePath)) {
    unlinkSync(reviewFilePath);
    console.log(`✓ Deleted ${reviewFileName}`);
  }
}

export function runImportCli(
  npmScript: string,
  exampleFile: string,
  run: (filePath: string) => Promise<void>
): void {
  const [, , filePath] = process.argv;

  if (!filePath) {
    console.error(`Usage: npm run ${npmScript} <file.json>`);
    console.error(`Example: npm run ${npmScript} ${exampleFile}`);
    process.exit(1);
  }

  run(resolve(process.cwd(), filePath)).catch((err) => {
    console.error('❌ Import failed:', err.message);
    process.exit(1);
  });
}
