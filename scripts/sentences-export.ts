import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Sentence, CEFRLevel } from './types.js';
import { isValidLevel } from './types.js';

async function exportSentences(level?: string) {
  if (level && !isValidLevel(level)) {
    console.error(`❌ Invalid level: ${level}`);
    console.error('   Valid levels: A1, A2, B1, B2, C1, C2');
    process.exit(1);
  }

  console.log(
    level
      ? `📥 Fetching ${level} sentences from Firestore...`
      : '📥 Fetching all sentences from Firestore...'
  );

  let query: FirebaseFirestore.Query = db.collection('sentences');

  if (level) {
    query = query.where('level', '==', level);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log('⚠️  No sentences found');
    return;
  }

  const sentences = snapshot.docs
    .map((doc) => doc.data() as Sentence)
    .sort((a, b) => a.id.localeCompare(b.id));

  const outputPath = level
    ? resolve(process.cwd(), `sentences-${level}.json`)
    : resolve(process.cwd(), 'sentences-all.json');

  writeFileSync(outputPath, JSON.stringify(sentences, null, 2));

  const levelCounts = sentences.reduce(
    (acc, s) => {
      acc[s.level] = (acc[s.level] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`✓ Exported ${sentences.length} sentences to ${outputPath}`);
  if (!level) {
    console.log('  Breakdown by level:');
    Object.entries(levelCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([lvl, count]) => {
        console.log(`    ${lvl}: ${count}`);
      });
  }
}

const [, , level] = process.argv;

exportSentences(level?.toUpperCase() as CEFRLevel | undefined).catch((err) => {
  console.error('❌ Export failed:', err.message);
  process.exit(1);
});

