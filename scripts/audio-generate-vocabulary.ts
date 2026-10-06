import { runSingleFieldAudioScript } from './lib/singleFieldAudio.js';

runSingleFieldAudioScript({
  npmScript: 'audio:vocabulary',
  title: 'Vocabulary',
  collection: 'vocabulary',
  storageFolder: 'vocabulary',
  outputDir: 'audio-test-vocabulary',
  textField: 'polish',
  audioField: 'audioUrl',
  noun: { singular: 'vocabulary', plural: 'words' },
  statsLabel: 'vocabulary words',
  fullRunTarget: 'all vocabulary',
  testItems: [
    { id: 'test-1', text: 'dzień dobry' },
    { id: 'test-2', text: 'dziękuję' },
    { id: 'test-3', text: 'przepraszam' },
    { id: 'test-4', text: 'kobieta' },
    { id: 'test-5', text: 'mężczyzna' },
  ],
});
