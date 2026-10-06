import { db } from './firebase-admin.js';
import type { Tense } from './verb-types.js';
import {
  ensureBucketExists,
  errorMessage,
  formatCost,
  generateAudio,
  runAudioCli,
  runTestMode,
  uploadToStorage,
} from './lib/audioTts.js';

const STORAGE_FOLDER = 'conjugation';
const OUTPUT_DIR = 'audio-test-conjugation';

interface ConjugationForm {
  pl: string;
  plAlternatives?: string[];
  en: string[];
  audioUrl?: string;
}

interface Verb {
  id: string;
  infinitive: string;
  conjugations: Partial<Record<Tense, Record<string, ConjugationForm>>>;
}

const TENSES: Tense[] = ['present', 'past', 'future', 'imperative', 'conditional'];

interface FormEntry {
  tense: Tense;
  formKey: string;
  form: ConjugationForm;
}

const listForms = (verb: Verb): FormEntry[] =>
  TENSES.flatMap((tense) =>
    Object.entries(verb.conjugations[tense] ?? {}).map(([formKey, form]) => ({
      tense,
      formKey,
      form,
    }))
  );

async function fetchVerbs(limit?: number): Promise<Verb[]> {
  console.log('📂 Fetching verbs from Firestore...');
  const query = db.collection('verbs');
  const snapshot = await (limit ? query.limit(limit) : query).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Verb);
}

/** Generates and uploads one form's audio, writing the URL onto the form in place. */
async function processForm(verb: Verb, { tense, formKey, form }: FormEntry): Promise<string> {
  const audioBuffer = await generateAudio(form.pl);
  const audioUrl = await uploadToStorage(
    audioBuffer,
    STORAGE_FOLDER,
    `${verb.id}_${tense}_${formKey}.mp3`
  );
  form.audioUrl = audioUrl;
  return audioUrl;
}

const saveConjugations = (verb: Verb) =>
  db.collection('verbs').doc(verb.id).update({ conjugations: verb.conjugations });

async function runPreviewMode(limit: number): Promise<void> {
  console.log(`🔍 Running PREVIEW MODE (${limit} verbs)`);
  console.log('   This tests the full end-to-end flow: TTS → Storage → Firestore\n');
  await ensureBucketExists({ verbose: true });

  const verbs = await fetchVerbs(limit);
  console.log(`   Found ${verbs.length} verbs to process\n`);

  let processedForms = 0;
  let errors = 0;

  for (const verb of verbs) {
    console.log(`\n🔤 Processing verb: ${verb.infinitive} (${verb.id})`);
    let verbUpdated = false;

    for (const entry of listForms(verb)) {
      try {
        console.log(`   📝 ${entry.tense}.${entry.formKey}: "${entry.form.pl}"`);
        const audioUrl = await processForm(verb, entry);
        console.log(`      ✓ Uploaded: ${audioUrl}`);
        verbUpdated = true;
        processedForms++;
      } catch (error) {
        console.error(`      ❌ Error: ${errorMessage(error)}`);
        errors++;
      }
    }

    if (verbUpdated) {
      await saveConjugations(verb);
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
  await ensureBucketExists();

  const verbs = await fetchVerbs();
  console.log(`   Found ${verbs.length} verbs\n`);

  const allForms = verbs.flatMap(listForms);
  const formsToProcess = allForms.filter(({ form }) => !skipExisting || !form.audioUrl);
  const totalChars = formsToProcess.reduce((sum, { form }) => sum + form.pl.length, 0);

  console.log(`📊 Total conjugation forms: ${allForms.length.toLocaleString()}`);
  console.log(`   Forms to process: ${formsToProcess.length.toLocaleString()}`);
  console.log(`   Total characters: ${totalChars.toLocaleString()}`);
  console.log(`   Estimated cost (Gemini TTS): ${formatCost(totalChars)}\n`);

  let processedForms = 0;
  let skippedForms = 0;
  let errors = 0;
  let verbsProcessed = 0;

  for (const verb of verbs) {
    let verbUpdated = false;

    for (const entry of listForms(verb)) {
      if (skipExisting && entry.form.audioUrl) {
        skippedForms++;
        continue;
      }

      const label = `${verb.infinitive} ${entry.tense}.${entry.formKey}`;
      process.stdout.write(
        `\r⏳ Processing ${processedForms + skippedForms + 1}/${allForms.length}: ${label}...`.padEnd(
          80
        )
      );
      try {
        await processForm(verb, entry);
        verbUpdated = true;
        processedForms++;
      } catch (error) {
        console.error(
          `\n❌ Error for ${verb.id} ${entry.tense}.${entry.formKey}: ${errorMessage(error)}`
        );
        errors++;
      }
    }

    if (verbUpdated) {
      await saveConjugations(verb);
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
  const forms = verbs.flatMap(listForms).map(({ form }) => form);
  const withoutAudio = forms.filter((form) => !form.audioUrl);
  const totalChars = withoutAudio.reduce((sum, form) => sum + form.pl.length, 0);

  console.log(`Total verbs: ${verbs.length}`);
  console.log(`Total conjugation forms: ${forms.length.toLocaleString()}`);
  console.log(`  With audio: ${(forms.length - withoutAudio.length).toLocaleString()}`);
  console.log(`  Without audio: ${withoutAudio.length.toLocaleString()}`);
  console.log(`\nCharacters to process: ${totalChars.toLocaleString()}`);
  console.log(`Estimated cost (Gemini TTS): ${formatCost(totalChars)}`);
}

runAudioCli({
  npmScript: 'audio:conjugation',
  title: 'Conjugations',
  defaultPreviewLimit: 1,
  usage: {
    preview: 'Test end-to-end with 1 verb',
    full: 'Generate audio for all conjugation forms',
    skipExisting: 'Skip forms with existing audio',
  },
  outputDir: OUTPUT_DIR,
  notes:
    'Note: Each verb has multiple conjugation forms (present, past, future, etc.).\n' +
    'The script processes all forms for each verb and stores audio URLs within the\n' +
    "verb document's conjugations structure.",
  test: () =>
    runTestMode({
      description: 'conjugation forms',
      outputDir: OUTPUT_DIR,
      items: [
        { id: 'test-1', text: 'robię' },
        { id: 'test-2', text: 'robiłem' },
        { id: 'test-3', text: 'będę robić' },
        { id: 'test-4', text: 'zrobiłbym' },
        { id: 'test-5', text: 'róbcie' },
      ],
      fullRunTarget: 'all conjugations',
    }),
  preview: runPreviewMode,
  full: runFullMode,
  stats: showStats,
});
