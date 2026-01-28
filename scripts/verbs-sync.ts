import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { VerbIndex, Verb } from './verb-types.js';

const INDEX_PATH = resolve(process.cwd(), 'verbIndex.json');

async function syncVerbs() {
  console.log('🔄 Fetching verbs from Firestore...');

  const snapshot = await db.collection('verbs').get();
  const verbs = snapshot.docs.map((doc) => doc.data() as Verb);

  console.log(`📊 Found ${verbs.length} verbs`);

  const index: VerbIndex[] = verbs
    .map((v) => ({
      id: v.id,
      infinitive: v.infinitive,
      aspect: v.aspect,
      verbClass: v.verbClass,
    }))
    .sort((a, b) => a.infinitive.localeCompare(b.infinitive, 'pl'));

  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`✓ Wrote ${index.length} entries to verbIndex.json`);

  console.log('\n✅ Sync complete!');
}

syncVerbs().catch((err) => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});

