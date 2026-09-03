import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DeclensionCard, DeclensionCase } from './types.js';
import { isValidCase } from './types.js';

async function exportCards(caseFilter?: string) {
  if (caseFilter && !isValidCase(caseFilter)) {
    console.error(`❌ Invalid case: ${caseFilter}`);
    console.error(
      '   Valid cases: Nominative, Genitive, Dative, Accusative, Instrumental, Locative, Vocative'
    );
    process.exit(1);
  }

  console.log(
    caseFilter
      ? `📥 Fetching ${caseFilter} cards from Firestore...`
      : '📥 Fetching all cards from Firestore...'
  );

  let query: FirebaseFirestore.Query = db.collection('declensionCards');

  if (caseFilter) {
    query = query.where('case', '==', caseFilter);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('⚠️  No cards found');
    return;
  }

  const cards = snapshot.docs
    .map((doc) => doc.data() as DeclensionCard)
    .sort((a, b) => a.id - b.id);

  const outputPath = caseFilter
    ? resolve(process.cwd(), `declension-${caseFilter.toLowerCase()}.json`)
    : resolve(process.cwd(), 'declension-all.json');

  writeFileSync(outputPath, JSON.stringify(cards, null, 2));

  const caseCounts = cards.reduce(
    (acc, c) => {
      acc[c.case] = (acc[c.case] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`✓ Exported ${cards.length} cards to ${outputPath}`);
  if (!caseFilter) {
    console.log('  Breakdown by case:');
    Object.entries(caseCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([caseType, count]) => {
        console.log(`    ${caseType}: ${count}`);
      });
  }
}

const [, , caseArg] = process.argv;

const normalizedCase = caseArg
  ? caseArg.charAt(0).toUpperCase() + caseArg.slice(1).toLowerCase()
  : undefined;

exportCards(normalizedCase as DeclensionCase | undefined).catch((err) => {
  console.error('❌ Export failed:', err.message);
  process.exit(1);
});
