import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { DeclensionCardIndex, DeclensionCard } from './types.js';
import { printBreakdown } from './lib/printBreakdown.js';

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

  console.log(`✓ Fetched ${cards.length} cards from Firestore`);
  printBreakdown('case', cards, (c) => c.case);
  printBreakdown('gender', cards, (c) => c.gender);
  console.log('✓ Updated declensionCardIndex.json');
}

sync().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
