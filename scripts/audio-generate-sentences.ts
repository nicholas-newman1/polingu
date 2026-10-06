import { runSingleFieldAudioScript } from './lib/singleFieldAudio.js';

runSingleFieldAudioScript({
  npmScript: 'audio:sentences',
  title: 'Sentences',
  collection: 'sentences',
  storageFolder: 'sentences',
  outputDir: 'audio-test-sentences',
  textField: 'polish',
  audioField: 'audioUrl',
  getId: (doc) => doc.data().id as string,
  noun: { singular: 'sentence', plural: 'sentences' },
  statsLabel: 'sentences',
  fullRunTarget: 'all sentences',
  testItems: [
    { id: 'test-1', text: 'Dzień dobry, jak się masz?' },
    { id: 'test-2', text: 'Chciałbym zamówić kawę z mlekiem.' },
    { id: 'test-3', text: 'Przepraszam, gdzie jest dworzec kolejowy?' },
    { id: 'test-4', text: 'Bardzo dziękuję za pomoc.' },
    { id: 'test-5', text: 'Uczę się języka polskiego od trzech miesięcy.' },
  ],
});
