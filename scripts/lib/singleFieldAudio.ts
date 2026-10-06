import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { db } from '../firebase-admin.js';
import {
  ensureBucketExists,
  errorMessage,
  formatCost,
  generateAudio,
  runAudioCli,
  runTestMode,
  uploadToStorage,
} from './audioTts.js';

interface AudioItem {
  id: string;
  text: string;
  hasAudio: boolean;
}

interface SingleFieldAudioConfig {
  npmScript: string;
  title: string;
  collection: string;
  storageFolder: string;
  outputDir: string;
  /** Field holding the text to synthesize. */
  textField: string;
  /** Field the audio URL is written to. */
  audioField: string;
  /** Defaults to the Firestore document id. */
  getId?: (doc: QueryDocumentSnapshot) => string;
  noun: { singular: string; plural: string };
  /** Shown in stats output, e.g. "vocabulary words". */
  statsLabel: string;
  /** Target of "--full" in messages, e.g. "all vocabulary". */
  fullRunTarget: string;
  testItems: { id: string; text: string }[];
  notes?: string;
  extraStats?: (docs: QueryDocumentSnapshot[]) => string[];
}

/** CLI for collections where each document gets one audio file from one text field. */
export function runSingleFieldAudioScript(config: SingleFieldAudioConfig): void {
  const { collection, noun, audioField } = config;

  const toItem = (doc: QueryDocumentSnapshot): AudioItem => {
    const data = doc.data();
    return {
      id: config.getId ? config.getId(doc) : doc.id,
      text: data[config.textField] as string,
      hasAudio: Boolean(data[audioField]),
    };
  };

  const fetchItems = async (limit?: number): Promise<AudioItem[]> => {
    console.log(`📂 Fetching ${noun.plural} from Firestore...`);
    const query = db.collection(collection);
    const snapshot = await (limit ? query.limit(limit) : query).get();
    return snapshot.docs.map(toItem);
  };

  const processItem = async (item: AudioItem): Promise<string> => {
    const audioBuffer = await generateAudio(item.text);
    const audioUrl = await uploadToStorage(audioBuffer, config.storageFolder, `${item.id}.mp3`);
    await db
      .collection(collection)
      .doc(item.id)
      .update({ [audioField]: audioUrl });
    return audioUrl;
  };

  const preview = async (limit: number) => {
    console.log(`🔍 Running PREVIEW MODE (${limit} ${noun.plural})`);
    console.log('   This tests the full end-to-end flow: TTS → Storage → Firestore\n');
    await ensureBucketExists({ verbose: true });

    const items = await fetchItems(limit);
    console.log(`   Found ${items.length} ${noun.plural} to process\n`);

    let processed = 0;
    let errors = 0;
    for (const item of items) {
      try {
        console.log(`📝 "${item.text}"`);
        const audioUrl = await processItem(item);
        console.log(`   ✓ Uploaded: ${audioUrl}`);
        console.log(`   ✓ Firestore updated\n`);
        processed++;
      } catch (error) {
        console.error(`   ❌ Error: ${errorMessage(error)}\n`);
        errors++;
      }
    }

    console.log('✅ Preview complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);
    if (processed > 0 && errors === 0) {
      console.log(`\n🎉 Everything works! Run --full when ready to process ${config.fullRunTarget}.`);
    }
  };

  const full = async (skipExisting: boolean) => {
    console.log('🚀 Running in FULL MODE');
    console.log(`   Skip existing: ${skipExisting}\n`);
    await ensureBucketExists();

    const items = await fetchItems();
    console.log(`   Found ${items.length} ${noun.plural}\n`);

    const toProcess = skipExisting ? items.filter((i) => !i.hasAudio) : items;
    const totalChars = toProcess.reduce((sum, i) => sum + i.text.length, 0);
    console.log(`📊 ${capitalize(noun.plural)} to process: ${toProcess.length}`);
    console.log(`   Total characters: ${totalChars.toLocaleString()}`);
    console.log(`   Estimated cost (Gemini TTS): ${formatCost(totalChars)}\n`);

    let processed = 0;
    let errors = 0;
    const skipped = items.length - toProcess.length;
    for (const item of toProcess) {
      process.stdout.write(
        `\r⏳ Processing ${skipped + processed + errors + 1}/${items.length}: ${item.text.substring(0, 40)}...`.padEnd(
          60
        )
      );
      try {
        await processItem(item);
        processed++;
      } catch (error) {
        console.error(`\n❌ Error for "${item.id}": ${errorMessage(error)}`);
        errors++;
      }
    }

    console.log('\n');
    console.log('✅ Audio generation complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Skipped (already had audio): ${skipped}`);
    console.log(`   Errors: ${errors}`);
  };

  const stats = async () => {
    console.log(`📊 Fetching ${noun.singular} statistics...\n`);
    const snapshot = await db.collection(collection).get();
    const items = snapshot.docs.map(toItem);
    const withAudio = items.filter((i) => i.hasAudio).length;
    const totalChars = items.filter((i) => !i.hasAudio).reduce((sum, i) => sum + i.text.length, 0);

    console.log(`Total ${config.statsLabel}: ${items.length}`);
    console.log(`  With audio: ${withAudio}`);
    console.log(`  Without audio: ${items.length - withAudio}`);
    config.extraStats?.(snapshot.docs).forEach((line) => console.log(line));
    console.log(`\nCharacters to process: ${totalChars.toLocaleString()}`);
    console.log(`Estimated cost (Gemini TTS): ${formatCost(totalChars)}`);
  };

  runAudioCli({
    npmScript: config.npmScript,
    title: config.title,
    defaultPreviewLimit: 3,
    usage: {
      preview: `Test end-to-end with 3 real ${noun.plural}`,
      full: `Generate audio for ${config.fullRunTarget}`,
      skipExisting: `Skip ${noun.plural} with existing audio`,
    },
    outputDir: config.outputDir,
    notes: config.notes,
    test: () =>
      runTestMode({
        description: config.statsLabel,
        outputDir: config.outputDir,
        items: config.testItems,
        fullRunTarget: config.fullRunTarget,
      }),
    preview,
    full,
    stats,
  });
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
