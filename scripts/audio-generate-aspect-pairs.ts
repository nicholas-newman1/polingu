import { db } from './firebase-admin.js';
import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

function getServiceAccountPath(): string {
  const possiblePaths = [
    resolve(process.cwd(), 'service-account.json'),
    resolve(process.cwd(), 'serviceAccountKey.json'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  console.error(
    '❌ No service account found. Please either:\n' +
      '   1. Place service-account.json in the project root, or\n' +
      '   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable'
  );
  process.exit(1);
}

const keyFilename = getServiceAccountPath();
const credentials = JSON.parse(readFileSync(keyFilename, 'utf-8'));

const ttsClient = new TextToSpeechClient({ credentials });
const storage = new Storage({ credentials, projectId: credentials.project_id });

// Configuration
const BUCKET_NAME = 'polingu-audio';
const AUDIO_CONFIG: protos.google.cloud.texttospeech.v1.IAudioConfig = {
  audioEncoding: 'MP3',
};

const TTS_VOICE = {
  languageCode: 'pl-PL',
  name: 'pl-PL-Wavenet-B',
};

// Test infinitives for verification
const TEST_INFINITIVES = [
  { id: 'test-1', infinitive: 'robić' },
  { id: 'test-2', infinitive: 'zrobić' },
  { id: 'test-3', infinitive: 'mówić' },
  { id: 'test-4', infinitive: 'powiedzieć' },
  { id: 'test-5', infinitive: 'chodzić' },
];

interface Verb {
  id: string;
  infinitive: string;
  aspectPair?: string;
  infinitiveAudioUrl?: string;
}

async function generateAudio(text: string): Promise<Buffer> {
  const request = {
    input: { text },
    voice: TTS_VOICE,
    audioConfig: AUDIO_CONFIG,
  };

  const [response] = await ttsClient.synthesizeSpeech(request);

  if (!response.audioContent) {
    throw new Error('No audio content in response');
  }

  return Buffer.from(response.audioContent as Uint8Array);
}

async function uploadToStorage(audioBuffer: Buffer, fileName: string): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(`infinitives/${fileName}`);

  await file.save(audioBuffer, {
    contentType: 'audio/mpeg',
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/infinitives/${fileName}`;
}

async function saveLocalTest(audioBuffer: Buffer, fileName: string): Promise<string> {
  const outputDir = resolve(process.cwd(), 'audio-test-aspect-pairs');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filePath = resolve(outputDir, fileName);
  writeFileSync(filePath, audioBuffer);
  return filePath;
}

async function runTestMode(): Promise<void> {
  console.log('🧪 Running in TEST MODE');
  console.log('   Generating audio for 5 sample verb infinitives...\n');

  for (const verb of TEST_INFINITIVES) {
    try {
      console.log(`📝 "${verb.infinitive}"`);
      const audioBuffer = await generateAudio(verb.infinitive);
      const fileName = `${verb.id}.mp3`;
      const filePath = await saveLocalTest(audioBuffer, fileName);
      console.log(`   ✓ Saved to: ${filePath}`);
      console.log(`   📊 Size: ${(audioBuffer.length / 1024).toFixed(1)} KB\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}\n`);
    }
  }

  console.log(
    '✅ Test complete! Check the audio-test-aspect-pairs/ folder to listen to the files.'
  );
  console.log('   If the quality is good, run with --full to process all verb infinitives.');
}

async function runPreviewMode(limit: number): Promise<void> {
  console.log(`🔍 Running PREVIEW MODE (${limit} verbs)`);
  console.log('   This tests the full end-to-end flow: TTS → Storage → Firestore\n');

  // Verify bucket exists
  try {
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    if (!exists) {
      console.error(`❌ Bucket "${BUCKET_NAME}" does not exist.`);
      console.error('   Please create it in Google Cloud Console first:');
      console.error(`   https://console.cloud.google.com/storage/create-bucket`);
      process.exit(1);
    }
    console.log(`✓ Bucket "${BUCKET_NAME}" exists`);
  } catch (error) {
    console.error(`❌ Error checking bucket: ${(error as Error).message}`);
    process.exit(1);
  }

  console.log('📂 Fetching verbs from Firestore...');
  const snapshot = await db.collection('verbs').limit(limit).get();
  const verbs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Verb);

  console.log(`   Found ${verbs.length} verbs to process\n`);

  let processed = 0;
  let errors = 0;

  for (const verb of verbs) {
    try {
      console.log(`📝 "${verb.infinitive}" (${verb.id})`);
      const audioBuffer = await generateAudio(verb.infinitive);
      const fileName = `${verb.id}.mp3`;
      const infinitiveAudioUrl = await uploadToStorage(audioBuffer, fileName);
      console.log(`   ✓ Uploaded: ${infinitiveAudioUrl}`);

      await db.collection('verbs').doc(verb.id).update({ infinitiveAudioUrl });
      console.log(`   ✓ Firestore updated\n`);

      processed++;
    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}\n`);
      errors++;
    }
  }

  console.log('✅ Preview complete!');
  console.log(`   Processed: ${processed}`);
  console.log(`   Errors: ${errors}`);

  if (processed > 0 && errors === 0) {
    console.log('\n🎉 Everything works! Run --full when ready to process all verb infinitives.');
  }
}

async function runFullMode(skipExisting: boolean): Promise<void> {
  console.log('🚀 Running in FULL MODE');
  console.log(`   Skip existing: ${skipExisting}\n`);

  // Verify bucket exists
  try {
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    if (!exists) {
      console.error(`❌ Bucket "${BUCKET_NAME}" does not exist.`);
      console.error('   Please create it in Google Cloud Console first:');
      console.error(`   https://console.cloud.google.com/storage/create-bucket`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error checking bucket: ${(error as Error).message}`);
    process.exit(1);
  }

  console.log('📂 Fetching verbs from Firestore...');
  const snapshot = await db.collection('verbs').get();
  const verbs = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Verb);

  console.log(`   Found ${verbs.length} verbs\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const verbsToProcess = skipExisting ? verbs.filter((v) => !v.infinitiveAudioUrl) : verbs;
  const totalChars = verbsToProcess.reduce((sum, v) => sum + v.infinitive.length, 0);

  console.log(`📊 Total verbs: ${verbs.length}`);
  console.log(`   Verbs to process: ${verbsToProcess.length}`);
  console.log(`   Total characters: ${totalChars.toLocaleString()}`);
  console.log(`   Estimated cost (Gemini TTS): $${((totalChars / 1_000_000) * 30).toFixed(4)}\n`);

  for (const verb of verbs) {
    if (skipExisting && verb.infinitiveAudioUrl) {
      skipped++;
      continue;
    }

    try {
      process.stdout.write(
        `\r⏳ Processing ${processed + skipped + 1}/${verbs.length}: ${verb.infinitive}...`.padEnd(
          60
        )
      );

      const audioBuffer = await generateAudio(verb.infinitive);
      const fileName = `${verb.id}.mp3`;
      const infinitiveAudioUrl = await uploadToStorage(audioBuffer, fileName);

      await db.collection('verbs').doc(verb.id).update({ infinitiveAudioUrl });

      processed++;
    } catch (error) {
      console.error(`\n❌ Error for "${verb.id}": ${(error as Error).message}`);
      errors++;
    }
  }

  console.log('\n');
  console.log('✅ Audio generation complete!');
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped (already had audio): ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

async function showStats(): Promise<void> {
  console.log('📊 Fetching verb infinitive statistics...\n');

  const snapshot = await db.collection('verbs').get();
  const verbs = snapshot.docs.map((doc) => doc.data() as Verb);

  const withAudio = verbs.filter((v) => v.infinitiveAudioUrl).length;
  const withoutAudio = verbs.length - withAudio;
  const totalChars = verbs
    .filter((v) => !v.infinitiveAudioUrl)
    .reduce((sum, v) => sum + v.infinitive.length, 0);

  // Count verbs with aspect pairs (used in aspect pairs feature)
  const withAspectPair = verbs.filter((v) => v.aspectPair).length;

  console.log(`Total verbs: ${verbs.length}`);
  console.log(`  With infinitive audio: ${withAudio}`);
  console.log(`  Without infinitive audio: ${withoutAudio}`);
  console.log(`\nVerbs with aspect pairs: ${withAspectPair}`);
  console.log(`\nCharacters to process: ${totalChars.toLocaleString()}`);
  console.log(`Estimated cost (Gemini TTS): $${((totalChars / 1_000_000) * 30).toFixed(4)}`);
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === '--test') {
  runTestMode().catch(console.error);
} else if (command === '--preview') {
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 3;
  runPreviewMode(limit).catch(console.error);
} else if (command === '--full') {
  const skipExisting = args.includes('--skip-existing');
  runFullMode(skipExisting).catch(console.error);
} else if (command === '--stats') {
  showStats().catch(console.error);
} else {
  console.log(`
Audio Generation Script for Polingu Aspect Pairs (Verb Infinitives)
====================================================================

Usage:
  npm run audio:aspect-pairs -- --test           Generate test audio files locally
  npm run audio:aspect-pairs -- --stats          Show statistics and cost estimate
  npm run audio:aspect-pairs -- --preview        Test end-to-end with 3 verbs
  npm run audio:aspect-pairs -- --preview --limit=5   Preview with custom limit
  npm run audio:aspect-pairs -- --full           Generate audio for all verb infinitives
  npm run audio:aspect-pairs -- --full --skip-existing  Skip verbs with existing audio

Prerequisites:
  1. Enable Cloud Text-to-Speech API in Google Cloud Console
  2. Enable Vertex AI API in Google Cloud Console
  3. Create a Cloud Storage bucket named "${BUCKET_NAME}"
  4. Make bucket public (grant allUsers Storage Object Viewer role)
  5. Ensure service-account.json has Vertex AI User role

This script generates audio for verb infinitives, which are used in the
Aspect Pairs feature. The audio is stored as infinitiveAudioUrl on each verb.

Test mode saves files to ./audio-test-aspect-pairs/ so you can verify quality
before running the full generation.
`);
}
