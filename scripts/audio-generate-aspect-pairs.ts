import { runSingleFieldAudioScript } from './lib/singleFieldAudio.js';

runSingleFieldAudioScript({
  npmScript: 'audio:aspect-pairs',
  title: 'Aspect Pairs (Verb Infinitives)',
  collection: 'verbs',
  storageFolder: 'infinitives',
  outputDir: 'audio-test-aspect-pairs',
  textField: 'infinitive',
  audioField: 'infinitiveAudioUrl',
  noun: { singular: 'verb infinitive', plural: 'verbs' },
  statsLabel: 'verb infinitives',
  fullRunTarget: 'all verb infinitives',
  testItems: [
    { id: 'test-1', text: 'robić' },
    { id: 'test-2', text: 'zrobić' },
    { id: 'test-3', text: 'mówić' },
    { id: 'test-4', text: 'powiedzieć' },
    { id: 'test-5', text: 'chodzić' },
  ],
  notes:
    'This script generates audio for verb infinitives, which are used in the\n' +
    'Aspect Pairs feature. The audio is stored as infinitiveAudioUrl on each verb.',
  extraStats: (docs) => [
    `\nVerbs with aspect pairs: ${docs.filter((doc) => doc.data().aspectPair).length}`,
  ],
});
