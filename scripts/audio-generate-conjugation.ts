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

// Test phrases for verification
const TEST_PHRASES = [
  { id: 'test-1', text: 'robię' },
  { id: 'test-2', text: 'robiłem' },
  { id: 'test-3', text: 'będę robić' },
  { id: 'test-4', text: 'zrobiłbym' },
  { id: 'test-5', text: 'róbcie' },
];

type Tense = 'present' | 'past' | 'future' | 'imperative' | 'conditional';

interface ConjugationForm {
  pl: string;
  plAlternatives?: string[];
  en: string[];
  audioUrl?: string;
}

interface Verb {
  id: string;
  infinitive: string;
  conjugations: {
    present?: Record<string, ConjugationForm>;
    past?: Record<string, ConjugationForm>;
    future?: Record<string, ConjugationForm>;
    imperative?: Record<string, ConjugationForm>;
    conditional?: Record<string, ConjugationForm>;
  };
}

const TENSES: Tense[] = ['present', 'past', 'future', 'imperative', 'conditional'];

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
  const file = bucket.file(`conjugation/${fileName}`);

  await file.save(audioBuffer, {
    contentType: 'audio/mpeg',
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  return `https://storage.googleapis.com/${BUCKET_NAME}/conjugation/${fileName}`;
}

async function saveLocalTest(audioBuffer: Buffer, fileName: string): Promise<string> {
  const outputDir = resolve(process.cwd(), 'audio-test-conjugation');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filePath = resolve(outputDir, fileName);
  writeFileSync(filePath, audioBuffer);
  return filePath;
}

async function runTestMode(): Promise<void> {
  console.log('🧪 Running in TEST MODE');
  console.log('   Generating audio for 5 sample conjugation forms...\n');

  for (const phrase of TEST_PHRASES) {
    try {
      console.log(`📝 "${phrase.text}"`);
      const audioBuffer = await generateAudio(phrase.text);
      const fileName = `${phrase.id}.mp3`;
      const filePath = await saveLocalTest(audioBuffer, fileName);
      console.log(`   ✓ Saved to: ${filePath}`);
      console.log(`   📊 Size: ${(audioBuffer.length / 1024).toFixed(1)} KB\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${(error as Error).message}\n`);
    }
  }

  console.log('✅ Test complete! Check the audio-test-conjugation/ folder to listen to the files.');
  console.log('   If the quality is good, run with --full to process all conjugations.');
}

function countFormsInVerb(
  verb: Verb,
  skipExisting: boolean
): { total: number; toProcess: number; chars: number } {
  let total = 0;
  let toProcess = 0;
  let chars = 0;

  for (const tense of TENSES) {
    const tenseConjugations = verb.conjugations[tense];
    if (!tenseConjugations) continue;

    for (const [, form] of Object.entries(tenseConjugations)) {
      total++;
      if (!skipExisting || !form.audioUrl) {
        toProcess++;
        chars += form.pl.length;
      }
    }
  }

  return { total, toProcess, chars };
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

  let processedForms = 0;
  let errors = 0;

  for (const verb of verbs) {
    console.log(`\n🔤 Processing verb: ${verb.infinitive} (${verb.id})`);
    let verbUpdated = false;

    for (const tense of TENSES) {
      const tenseConjugations = verb.conjugations[tense];
      if (!tenseConjugations) continue;

      for (const [formKey, form] of Object.entries(tenseConjugations)) {
        try {
          console.log(`   📝 ${tense}.${formKey}: "${form.pl}"`);
          const audioBuffer = await generateAudio(form.pl);
          const fileName = `${verb.id}_${tense}_${formKey}.mp3`;
          const audioUrl = await uploadToStorage(audioBuffer, fileName);
          console.log(`      ✓ Uploaded: ${audioUrl}`);

          // Update form with audioUrl
          form.audioUrl = audioUrl;
          verbUpdated = true;
          processedForms++;
        } catch (error) {
          console.error(`      ❌ Error: ${(error as Error).message}`);
          errors++;
        }
      }
    }

    if (verbUpdated) {
      await db.collection('verbs').doc(verb.id).update({ conjugations: verb.conjugations });
      console.log(`   ✓ Firestore updated for ${verb.infinitive}`);
    }
  }

  console.log('\n✅ Preview complete!');
  console.log(`   Forms processed: ${processedForms}`);
  console.log(`   Errors: ${errors}`);

  if (processedForms > 0 && errors === 0) {
    console.log('\n🎉 Everything works! Run --full when ready to process all verbs.');
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

  // Count total forms
  let totalForms = 0;
  let formsToProcess = 0;
  let totalChars = 0;

  for (const verb of verbs) {
    const counts = countFormsInVerb(verb, skipExisting);
    totalForms += counts.total;
    formsToProcess += counts.toProcess;
    totalChars += counts.chars;
  }

  console.log(`📊 Total conjugation forms: ${totalForms.toLocaleString()}`);
  console.log(`   Forms to process: ${formsToProcess.toLocaleString()}`);
  console.log(`   Total characters: ${totalChars.toLocaleString()}`);
  console.log(`   Estimated cost (Gemini TTS): $${((totalChars / 1_000_000) * 30).toFixed(4)}\n`);

  let processedForms = 0;
  let skippedForms = 0;
  let errors = 0;
  let verbsProcessed = 0;

  for (const verb of verbs) {
    let verbUpdated = false;

    for (const tense of TENSES) {
      const tenseConjugations = verb.conjugations[tense];
      if (!tenseConjugations) continue;

      for (const [formKey, form] of Object.entries(tenseConjugations)) {
        if (skipExisting && form.audioUrl) {
          skippedForms++;
          continue;
        }

        try {
          process.stdout.write(
            `\r⏳ Processing ${processedForms + skippedForms + 1}/${totalForms}: ${verb.infinitive} ${tense}.${formKey}...`.padEnd(
              80
            )
          );

          const audioBuffer = await generateAudio(form.pl);
          const fileName = `${verb.id}_${tense}_${formKey}.mp3`;
          const audioUrl = await uploadToStorage(audioBuffer, fileName);

          form.audioUrl = audioUrl;
          verbUpdated = true;
          processedForms++;
        } catch (error) {
          console.error(
            `\n❌ Error for ${verb.id} ${tense}.${formKey}: ${(error as Error).message}`
          );
          errors++;
        }
      }
    }

    if (verbUpdated) {
      await db.collection('verbs').doc(verb.id).update({ conjugations: verb.conjugations });
      verbsProcessed++;
    }
  }

  console.log('\n');
  console.log('✅ Audio generation complete!');
  console.log(`   Verbs updated: ${verbsProcessed}`);
  console.log(`   Forms processed: ${processedForms}`);
  console.log(`   Forms skipped (already had audio): ${skippedForms}`);
  console.log(`   Errors: ${errors}`);
}

async function showStats(): Promise<void> {
  console.log('📊 Fetching conjugation statistics...\n');

  const snapshot = await db.collection('verbs').get();
  const verbs = snapshot.docs.map((doc) => doc.data() as Verb);

  let totalForms = 0;
  let withAudio = 0;
  let withoutAudio = 0;
  let totalChars = 0;

  for (const verb of verbs) {
    for (const tense of TENSES) {
      const tenseConjugations = verb.conjugations[tense];
      if (!tenseConjugations) continue;

      for (const [, form] of Object.entries(tenseConjugations)) {
        totalForms++;
        if (form.audioUrl) {
          withAudio++;
        } else {
          withoutAudio++;
          totalChars += form.pl.length;
        }
      }
    }
  }

  console.log(`Total verbs: ${verbs.length}`);
  console.log(`Total conjugation forms: ${totalForms.toLocaleString()}`);
  console.log(`  With audio: ${withAudio.toLocaleString()}`);
  console.log(`  Without audio: ${withoutAudio.toLocaleString()}`);
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
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 1;
  runPreviewMode(limit).catch(console.error);
} else if (command === '--full') {
  const skipExisting = args.includes('--skip-existing');
  runFullMode(skipExisting).catch(console.error);
} else if (command === '--stats') {
  showStats().catch(console.error);
} else {
  console.log(`
Audio Generation Script for Polingu Conjugations
=================================================

Usage:
  npm run audio:conjugation -- --test           Generate test audio files locally
  npm run audio:conjugation -- --stats          Show statistics and cost estimate
  npm run audio:conjugation -- --preview        Test end-to-end with 1 verb
  npm run audio:conjugation -- --preview --limit=3   Preview with custom limit
  npm run audio:conjugation -- --full           Generate audio for all conjugation forms
  npm run audio:conjugation -- --full --skip-existing  Skip forms with existing audio

Prerequisites:
  1. Enable Cloud Text-to-Speech API in Google Cloud Console
  2. Enable Vertex AI API in Google Cloud Console
  3. Create a Cloud Storage bucket named "${BUCKET_NAME}"
  4. Make bucket public (grant allUsers Storage Object Viewer role)
  5. Ensure service-account.json has Vertex AI User role

Note: Each verb has multiple conjugation forms (present, past, future, etc.).
The script processes all forms for each verb and stores audio URLs within the
verb document's conjugations structure.

Test mode saves files to ./audio-test-conjugation/ so you can verify quality before
running the full generation.
`);
}
