import { beforeEach, describe, expect, test, vi } from 'vitest';
import { generateAudioPreview, saveAudio } from '../../src/lib/audioGeneration';
import { server } from './support/fakeFunctions';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

beforeEach(() => server.reset());

describe('generating audio for a card', () => {
  test('a preview sends the text and audio type and returns the generated audio', async () => {
    server.handle('generateAudioPreview', () => ({ audioBase64: 'SUQzBAAAAAAA' }));

    expect(await generateAudioPreview('Dzień dobry', 'custom-vocabulary')).toBe('SUQzBAAAAAAA');
    expect(server.callsTo('generateAudioPreview')).toEqual([
      { text: 'Dzień dobry', type: 'custom-vocabulary' },
    ]);
  });

  test('saving sends the audio with its type, id and sub-path and returns the stored URL', async () => {
    server.handle('saveAudio', () => ({
      audioUrl: 'https://cdn.test/audio/declension/12/nom.mp3',
    }));

    expect(await saveAudio('SUQz', 'declension', '12', 'nom')).toBe(
      'https://cdn.test/audio/declension/12/nom.mp3'
    );
    expect(server.callsTo('saveAudio')).toEqual([
      { audioBase64: 'SUQz', type: 'declension', id: '12', subPath: 'nom' },
    ]);
  });

  test('saving without a sub-path sends none (null once encoded, which the server ignores)', async () => {
    server.handle('saveAudio', () => ({ audioUrl: 'https://cdn.test/audio/vocabulary/7.mp3' }));

    await saveAudio('SUQz', 'vocabulary', '7');

    expect(server.callsTo('saveAudio')).toEqual([
      { audioBase64: 'SUQz', type: 'vocabulary', id: '7', subPath: null },
    ]);
  });

  test('server failures reach the caller', async () => {
    server.handle('generateAudioPreview', () => {
      throw new Error('resource-exhausted');
    });
    server.handle('saveAudio', () => {
      throw new Error('permission-denied');
    });

    await expect(generateAudioPreview('x', 'sentence')).rejects.toThrow('resource-exhausted');
    await expect(saveAudio('SUQz', 'sentence', '1')).rejects.toThrow('permission-denied');
  });
});
