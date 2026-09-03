import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DeclensionCardIndex, DeclensionCard } from './types.js';

async function sync() {
  console.log('📥 Fetching declension cards from Firestore...');

  const snapshot = await db.collection('declensionCards').get();

  if (snapshot.empty) {
    console.log('⚠️  No cards found in Firestore');
    const index: DeclensionCardIndex[] = [];
    writeFileSync(
      resolve(process.cwd(), 'declensionCardIndex.json'),
      JSON.stringify(index, null, 2)
    );
    console.log('✓ Created empty declensionCardIndex.json');
    return;
  }

  const cards = snapshot.docs.map((doc) => doc.data() as DeclensionCard);

  const index: DeclensionCardIndex[] = cards.map((c) => ({
    id: c.id,
    front: c.front,
    case: c.case,
    gender: c.gender,
    number: c.number,
  }));

  index.sort((a, b) => a.id - b.id);

  writeFileSync(resolve(process.cwd(), 'declensionCardIndex.json'), JSON.stringify(index, null, 2));

  const caseCounts = cards.reduce(
    (acc, c) => {
      acc[c.case] = (acc[c.case] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const genderCounts = cards.reduce(
    (acc, c) => {
      acc[c.gender] = (acc[c.gender] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`✓ Fetched ${cards.length} cards from Firestore`);
  console.log('  Breakdown by case:');
  Object.entries(caseCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([caseType, count]) => {
      console.log(`    ${caseType}: ${count}`);
    });
  console.log('  Breakdown by gender:');
  Object.entries(genderCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([gender, count]) => {
      console.log(`    ${gender}: ${count}`);
    });
  console.log('✓ Updated declensionCardIndex.json');
}

sync().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
