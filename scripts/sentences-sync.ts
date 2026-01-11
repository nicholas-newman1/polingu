import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { SentenceIndex, Sentence } from './types.js';

async function sync() {
  console.log('📥 Fetching sentences from Firestore...');

  const snapshot = await db.collection('sentences').get();

  if (snapshot.empty) {
    console.log('⚠️  No sentences found in Firestore');
    const index: SentenceIndex[] = [];
    writeFileSync(
      resolve(process.cwd(), 'sentenceIndex.json'),
      JSON.stringify(index, null, 2)
    );
    console.log('✓ Created empty sentenceIndex.json');
    return;
  }

  const sentences = snapshot.docs.map((doc) => doc.data() as Sentence);

  const index: SentenceIndex[] = sentences.map((s) => ({
    id: s.id,
    polish: s.polish,
    level: s.level,
    tags: s.tags,
  }));

  index.sort((a, b) => a.id.localeCompare(b.id));

  writeFileSync(
    resolve(process.cwd(), 'sentenceIndex.json'),
    JSON.stringify(index, null, 2)
  );

  const levelCounts = sentences.reduce(
    (acc, s) => {
      acc[s.level] = (acc[s.level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`✓ Fetched ${sentences.length} sentences from Firestore`);
  console.log('  Breakdown by level:');
  Object.entries(levelCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([level, count]) => {
      console.log(`    ${level}: ${count}`);
    });
  console.log('✓ Updated sentenceIndex.json');
}

sync().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});

