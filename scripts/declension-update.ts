/**
 * Corrects existing built-in declension cards in Firestore.
 *
 *   npm run declension:update <file.json>            show what would change
 *   npm run declension:update <file.json> --apply    write it
 *
 * The file holds full cards (as `declension:export` writes them), each with the id
 * of a card that already exists. Only the content fields are written, so audio
 * fields are kept; a changed `back` makes onDeclensionCardWrite regenerate the
 * card's audio. declensionCardIndex.json is updated to match.
 *
 * This writes the shared production deck: run it without --apply first and check
 * every change.
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebase-admin.js';
import type { DeclensionCard, DeclensionCardIndex } from './types.js';
import { validateDeclensionCard } from './types.js';
import { abortOnValidationErrors, loadJsonIndex, readImportFile } from './lib/importHelpers.js';

const INDEX_PATH = resolve(process.cwd(), 'declensionCardIndex.json');
const CONTENT_FIELDS = [
  'front',
  'back',
  'declined',
  'case',
  'gender',
  'number',
  'english',
  'hint',
] as const;

type ContentField = (typeof CONTENT_FIELDS)[number];

function changedFields(current: Partial<DeclensionCard>, next: DeclensionCard): ContentField[] {
  return CONTENT_FIELDS.filter((field) => (current[field] ?? null) !== (next[field] ?? null));
}

async function updateCards(filePath: string, apply: boolean) {
  const items = readImportFile(filePath, 'cards');
  const cards = items.filter((card, i) => validateDeclensionCard(card, i)) as DeclensionCard[];
  abortOnValidationErrors(cards.length !== items.length, 'cards');

  const index = loadJsonIndex<DeclensionCardIndex>(INDEX_PATH);
  const updatedIds = new Set(cards.map((c) => c.id));
  const otherFronts = new Map(
    index.filter((c) => !updatedIds.has(c.id)).map((c) => [c.front.toLowerCase(), c.id])
  );
  const clashes = cards.filter((c) => otherFronts.has(c.front.toLowerCase()));
  if (clashes.length > 0) {
    clashes.forEach((c) =>
      console.error(
        `❌ Card ${c.id}'s front is already used by card ${otherFronts.get(c.front.toLowerCase())}`
      )
    );
    process.exit(1);
  }

  const refs = cards.map((card) => db.collection('declensionCards').doc(String(card.id)));
  const snapshots = await db.getAll(...refs);
  const missing = snapshots.filter((snap) => !snap.exists).map((snap) => snap.id);
  if (missing.length > 0) {
    console.error(
      `❌ No existing card with id ${missing.join(', ')}. Use declension:import for new cards.`
    );
    process.exit(1);
  }

  const batch = db.batch();
  let changes = 0;
  cards.forEach((card, i) => {
    const current = snapshots[i].data() as DeclensionCard;
    const fields = changedFields(current, card);
    if (fields.length === 0) return;
    changes++;
    console.log(`\nCard ${card.id}:`);
    for (const field of fields) {
      console.log(`  ${field}: ${JSON.stringify(current[field])} → ${JSON.stringify(card[field])}`);
    }
    const update: Record<string, unknown> = {};
    for (const field of fields) update[field] = card[field] ?? FieldValue.delete();
    batch.update(refs[i], update);
  });

  if (changes === 0) {
    console.log('\nNothing to change.');
    return;
  }
  if (!apply) {
    console.log(`\n${changes} card(s) would change. Run again with --apply to write them.`);
    return;
  }

  await batch.commit();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const nextIndex = index.map((entry) => {
    const card = byId.get(entry.id);
    return card
      ? {
          id: card.id,
          front: card.front,
          case: card.case,
          gender: card.gender,
          number: card.number,
        }
      : entry;
  });
  writeFileSync(INDEX_PATH, JSON.stringify(nextIndex, null, 2));
  console.log(`\n✅ Updated ${changes} card(s) and declensionCardIndex.json`);
}

const [, , filePath, flag] = process.argv;
if (!filePath) {
  console.error('Usage: npm run declension:update <file.json> [--apply]');
  process.exit(1);
}

updateCards(resolve(process.cwd(), filePath), flag === '--apply').catch((err) => {
  console.error('❌ Update failed:', err.message);
  process.exit(1);
});
