import { db } from './firebase-admin.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Verb, Aspect, VerbClass } from './verb-types.js';

interface ExportFilters {
  aspect?: Aspect;
  verbClass?: VerbClass;
  ids?: string[];
}

function parseFilters(args: string[]): ExportFilters {
  const filters: ExportFilters = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--aspect' && args[i + 1]) {
      filters.aspect = args[++i] as Aspect;
    } else if (arg === '--class' && args[i + 1]) {
      filters.verbClass = args[++i] as VerbClass;
    } else if (arg === '--ids' && args[i + 1]) {
      filters.ids = args[++i].split(',');
    }
  }

  return filters;
}

async function exportVerbs(outputFile: string, filters: ExportFilters) {
  console.log('🔄 Fetching verbs from Firestore...');

  const snapshot = await db.collection('verbs').get();
  let verbs = snapshot.docs.map((doc) => doc.data() as Verb);

  console.log(`📊 Found ${verbs.length} total verbs`);

  if (filters.aspect) {
    verbs = verbs.filter((v) => v.aspect === filters.aspect);
    console.log(`   Filtered by aspect "${filters.aspect}": ${verbs.length} verbs`);
  }

  if (filters.verbClass) {
    verbs = verbs.filter((v) => v.verbClass === filters.verbClass);
    console.log(`   Filtered by class "${filters.verbClass}": ${verbs.length} verbs`);
  }

  if (filters.ids) {
    const idSet = new Set(filters.ids);
    verbs = verbs.filter((v) => idSet.has(v.id));
    console.log(`   Filtered by IDs: ${verbs.length} verbs`);
  }

  verbs.sort((a, b) => a.infinitive.localeCompare(b.infinitive, 'pl'));

  const cleanVerbs = verbs.map((v) => {
    const { ...rest } = v as Verb & { createdAt?: unknown };
    delete (rest as { createdAt?: unknown }).createdAt;
    return rest;
  });

  writeFileSync(outputFile, JSON.stringify(cleanVerbs, null, 2));
  console.log(`✓ Exported ${cleanVerbs.length} verbs to ${outputFile}`);

  console.log('\n✅ Export complete!');
}

const args = process.argv.slice(2);
const outputFileIndex = args.findIndex((a) => !a.startsWith('--'));
const outputFile = args[outputFileIndex] ?? 'verbs-export.json';
const filters = parseFilters(args);

console.log('Export options:');
console.log(`  Output file: ${outputFile}`);
if (filters.aspect) console.log(`  Aspect: ${filters.aspect}`);
if (filters.verbClass) console.log(`  Verb class: ${filters.verbClass}`);
if (filters.ids) console.log(`  IDs: ${filters.ids.join(', ')}`);
console.log('');

exportVerbs(resolve(process.cwd(), outputFile), filters).catch((err) => {
  console.error('❌ Export failed:', err.message);
  process.exit(1);
});

