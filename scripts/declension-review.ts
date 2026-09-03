import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

interface DeclensionCard {
  id: number;
  front: string;
  back: string;
  declined: string;
  case: string;
  hint?: string;
}

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Usage: npm run declension:review <file.json>');
  process.exit(1);
}

const filePath = resolve(process.cwd(), inputFile);
const cards: DeclensionCard[] = JSON.parse(readFileSync(filePath, 'utf-8'));

const reviewList = cards.map((c) => ({
  id: c.id,
  front: c.front,
  back: c.back,
  declined: c.declined,
  case: c.case,
  hint: c.hint,
}));

const outputName = basename(inputFile, '.json') + '-review.json';
const outputPath = resolve(process.cwd(), outputName);

writeFileSync(outputPath, JSON.stringify(reviewList, null, 2));
console.log(`Created ${outputName} with ${cards.length} cards`);
