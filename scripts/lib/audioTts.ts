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

const credentials = JSON.parse(readFileSync(getServiceAccountPath(), 'utf-8'));

const ttsClient = new TextToSpeechClient({ credentials });
const storage = new Storage({ credentials, projectId: credentials.project_id });

const BUCKET_NAME = 'polingu-audio';

const AUDIO_CONFIG: protos.google.cloud.texttospeech.v1.IAudioConfig = {
  audioEncoding: 'MP3',
};

const TTS_VOICE = {
  languageCode: 'pl-PL',
  name: 'pl-PL-Wavenet-B',
};

export async function generateAudio(text: string): Promise<Buffer> {
  const [response] = await ttsClient.synthesizeSpeech({
    input: { text },
    voice: TTS_VOICE,
    audioConfig: AUDIO_CONFIG,
  });

  if (!response.audioContent) {
    throw new Error('No audio content in response');
  }

  return Buffer.from(response.audioContent as Uint8Array);
}

/** Uploads to `<folder>/<fileName>` in the public audio bucket and returns its URL. */
export async function uploadToStorage(
  audioBuffer: Buffer,
  folder: string,
  fileName: string
): Promise<string> {
  const path = `${folder}/${fileName}`;
  await storage
    .bucket(BUCKET_NAME)
    .file(path)
    .save(audioBuffer, {
      contentType: 'audio/mpeg',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

  return `https://storage.googleapis.com/${BUCKET_NAME}/${path}`;
}

/** Exits the process when the bucket is missing or unreachable. */
export async function ensureBucketExists({ verbose = false } = {}): Promise<void> {
  try {
    const [exists] = await storage.bucket(BUCKET_NAME).exists();
    if (!exists) {
      console.error(`❌ Bucket "${BUCKET_NAME}" does not exist.`);
      console.error('   Please create it in Google Cloud Console first:');
      console.error(`   https://console.cloud.google.com/storage/create-bucket`);
      process.exit(1);
    }
    if (verbose) console.log(`✓ Bucket "${BUCKET_NAME}" exists`);
  } catch (error) {
    console.error(`❌ Error checking bucket: ${(error as Error).message}`);
    process.exit(1);
  }
}

export const formatCost = (chars: number) => `$${((chars / 1_000_000) * 30).toFixed(4)}`;

export const errorMessage = (error: unknown) => (error as Error).message;

interface TestModeOptions {
  /** e.g. "vocabulary words" */
  description: string;
  outputDir: string;
  items: { id: string; text: string }[];
  /** e.g. "all vocabulary" */
  fullRunTarget: string;
}

/** Generates audio for sample phrases into a local folder so voice quality can be checked. */
export async function runTestMode({
  description,
  outputDir,
  items,
  fullRunTarget,
}: TestModeOptions): Promise<void> {
  console.log('🧪 Running in TEST MODE');
  console.log(`   Generating audio for ${items.length} sample ${description}...\n`);

  const dir = resolve(process.cwd(), outputDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (const item of items) {
    try {
      console.log(`📝 "${item.text}"`);
      const audioBuffer = await generateAudio(item.text);
      const filePath = resolve(dir, `${item.id}.mp3`);
      writeFileSync(filePath, audioBuffer);
      console.log(`   ✓ Saved to: ${filePath}`);
      console.log(`   📊 Size: ${(audioBuffer.length / 1024).toFixed(1)} KB\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${errorMessage(error)}\n`);
    }
  }

  console.log(`✅ Test complete! Check the ${outputDir}/ folder to listen to the files.`);
  console.log(`   If the quality is good, run with --full to process ${fullRunTarget}.`);
}

interface AudioCliOptions {
  npmScript: string;
  title: string;
  defaultPreviewLimit: number;
  /** Usage lines for --preview and --full, in order: preview, full, full --skip-existing. */
  usage: { preview: string; full: string; skipExisting: string };
  outputDir: string;
  notes?: string;
  test: () => Promise<void>;
  preview: (limit: number) => Promise<void>;
  full: (skipExisting: boolean) => Promise<void>;
  stats: () => Promise<void>;
}

export function runAudioCli(options: AudioCliOptions): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === '--test') {
    options.test().catch(console.error);
  } else if (command === '--preview') {
    const limitArg = args.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : options.defaultPreviewLimit;
    options.preview(limit).catch(console.error);
  } else if (command === '--full') {
    options.full(args.includes('--skip-existing')).catch(console.error);
  } else if (command === '--stats') {
    options.stats().catch(console.error);
  } else {
    printUsage(options);
  }
}

function printUsage({ npmScript, title, usage, outputDir, notes }: AudioCliOptions): void {
  const heading = `Audio Generation Script for Polingu ${title}`;
  const run = `npm run ${npmScript} --`;
  console.log(`
${heading}
${'='.repeat(heading.length)}

Usage:
  ${run} --test           Generate test audio files locally
  ${run} --stats          Show statistics and cost estimate
  ${run} --preview        ${usage.preview}
  ${run} --preview --limit=5   Preview with custom limit
  ${run} --full           ${usage.full}
  ${run} --full --skip-existing  ${usage.skipExisting}

Prerequisites:
  1. Enable Cloud Text-to-Speech API in Google Cloud Console
  2. Enable Vertex AI API in Google Cloud Console
  3. Create a Cloud Storage bucket named "${BUCKET_NAME}"
  4. Make bucket public (grant allUsers Storage Object Viewer role)
  5. Ensure service-account.json has Vertex AI User role
${notes ? `\n${notes}\n` : ''}
Test mode saves files to ./${outputDir}/ so you can verify quality before
running the full generation.
`);
}
