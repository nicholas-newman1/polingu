import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { Verb } from './verb-types.js';
import { validateVerb } from './verb-types.js';

async function validateVerbs(filePath: string) {
  console.log(`📂 Reading ${filePath}...`);

  if (!existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  let verbs: unknown[];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    verbs = Array.isArray(parsed) ? parsed : parsed.verbs;
    if (!Array.isArray(verbs)) {
      throw new Error('Expected array or object with verbs array');
    }
  } catch (err) {
    console.error(`❌ Failed to parse JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`📋 Validating ${verbs.length} verbs...`);

  const verbMap = new Map<string, unknown>();
  for (const verb of verbs) {
    const v = verb as Record<string, unknown>;
    if (typeof v.id === 'string') {
      verbMap.set(v.id, verb);
    }
  }

  let hasErrors = false;
  let validCount = 0;
  const allErrors: string[] = [];

  for (const verb of verbs) {
    const errors = validateVerb(verb, verbMap);
    if (errors.length > 0) {
      hasErrors = true;
      allErrors.push(...errors);
    } else {
      validCount++;
    }
  }

  if (hasErrors) {
    console.error('\n❌ Validation errors found:');
    allErrors.forEach((e) => console.error(`   - ${e}`));
    console.error(`\n❌ ${allErrors.length} errors in ${verbs.length - validCount} verbs`);
    console.error(`✓ ${validCount} verbs are valid`);
    process.exit(1);
  }

  console.log(`\n✅ All ${validCount} verbs are valid!`);
}

const [, , filePath] = process.argv;

if (!filePath) {
  console.error('Usage: npm run verbs:validate <file.json>');
  console.error('Example: npm run verbs:validate new-verbs.json');
  process.exit(1);
}

validateVerbs(resolve(process.cwd(), filePath)).catch((err) => {
  console.error('❌ Validation failed:', err.message);
  process.exit(1);
});

