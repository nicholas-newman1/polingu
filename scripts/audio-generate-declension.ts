import { runSingleFieldAudioScript } from './lib/singleFieldAudio.js';

runSingleFieldAudioScript({
  npmScript: 'audio:declension',
  title: 'Declension Cards',
  collection: 'declensionCards',
  storageFolder: 'declension',
  outputDir: 'audio-test-declension',
  textField: 'back',
  audioField: 'audioUrl',
  noun: { singular: 'declension card', plural: 'cards' },
  statsLabel: 'declension cards',
  fullRunTarget: 'all declension cards',
  testItems: [
    { id: 'test-1', text: 'Widzę piękną kobietę.' },
    { id: 'test-2', text: 'Idę do sklepu.' },
    { id: 'test-3', text: 'Rozmawiam z przyjacielem.' },
    { id: 'test-4', text: 'Myślę o wakacjach.' },
    { id: 'test-5', text: 'To jest dla mojej mamy.' },
  ],
});
