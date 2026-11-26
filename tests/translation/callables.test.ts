import { beforeEach, describe, expect, test, vi } from 'vitest';
import { processSentence } from '../../src/lib/processSentence';
import { generateExample, toExampleSentences } from '../../src/lib/generateExample';
import { discoverCurriculum, generateSentences } from '../../src/lib/generateSentences';
import { resetCallables, serveCallable } from './support/fakeFunctions';
import { functionsError } from './support/translateServer';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

beforeEach(() => {
  resetCallables();
});

describe('processSentence', () => {
  test('sends the sentence and its language, and returns the Polish/English pair with a level', async () => {
    const server = serveCallable('processSentence', () => ({
      polish: 'Kot śpi na kanapie.',
      english: 'The cat is sleeping on the sofa.',
      level: 'A2',
    }));

    const result = await processSentence({ text: 'The cat sleeps on the sofa', sourceLang: 'EN' });

    expect(server).toHaveBeenCalledWith({ text: 'The cat sleeps on the sofa', sourceLang: 'EN' });
    expect(result).toEqual({
      polish: 'Kot śpi na kanapie.',
      english: 'The cat is sleeping on the sofa.',
      level: 'A2',
    });
  });

  test('a server failure reaches the caller', async () => {
    const failure = functionsError('internal', 'boom');
    serveCallable('processSentence', () => {
      throw failure;
    });

    await expect(processSentence({ text: 'kot', sourceLang: 'PL' })).rejects.toBe(failure);
  });
});

describe('generateExample', () => {
  test('sends the word with its grammar hints and returns the generated examples', async () => {
    const examples = [
      { polish: 'Mam kota.', english: 'I have a cat.', meaning: 'animal' },
      { polish: 'Kot śpi.', english: 'The cat sleeps.' },
    ];
    const server = serveCallable('generateExample', () => ({ examples }));

    const result = await generateExample({
      polish: 'kot',
      english: 'cat',
      partOfSpeech: 'noun',
      gender: 'masculine',
    });

    expect(server).toHaveBeenCalledWith({
      polish: 'kot',
      english: 'cat',
      partOfSpeech: 'noun',
      gender: 'masculine',
    });
    expect(result.examples).toEqual(examples);
  });

  test('toExampleSentences keeps each Polish/English pair, gives each its own id, and drops the meaning', () => {
    const sentences = toExampleSentences([
      { polish: 'Mam kota.', english: 'I have a cat.', meaning: 'animal' },
      { polish: 'Kot śpi.', english: 'The cat sleeps.' },
    ]);

    expect(sentences.map(({ polish, english }) => ({ polish, english }))).toEqual([
      { polish: 'Mam kota.', english: 'I have a cat.' },
      { polish: 'Kot śpi.', english: 'The cat sleeps.' },
    ]);
    expect(sentences.every((s) => typeof s.id === 'string' && s.id.length > 0)).toBe(true);
    expect(new Set(sentences.map((s) => s.id)).size).toBe(2);
    expect(sentences[0]).not.toHaveProperty('meaning');
  });
});

describe('generateSentences', () => {
  test('requests sentences for a level and tags and returns them', async () => {
    const sentences = [
      {
        polish: 'Idę do sklepu.',
        english: 'I am going to the shop.',
        level: 'A1',
        tags: ['shopping'],
      },
    ];
    const server = serveCallable('generateSentences', () => ({ sentences }));

    const result = await generateSentences({
      level: 'A1',
      tags: ['shopping'],
      count: 1,
      guidance: 'everyday',
    });

    expect(server).toHaveBeenCalledWith({
      level: 'A1',
      tags: ['shopping'],
      count: 1,
      guidance: 'everyday',
    });
    expect(result.sentences).toEqual(sentences);
  });

  test('discoverCurriculum sends the mode and existing tags and returns the suggestions', async () => {
    const suggestions = [
      {
        tag: 'aspect',
        category: 'grammar',
        priority: 'high',
        explanation: 'Perfective vs imperfective',
        exampleConcepts: ['robić/zrobić'],
        relevantLevels: ['A2'],
      },
    ];
    const server = serveCallable('discoverCurriculum', () => ({ suggestions }));
    const request = {
      mode: 'grammar' as const,
      level: 'A2' as const,
      existingTags: { topics: ['food'], grammar: [], style: [] },
    };

    const result = await discoverCurriculum(request);

    expect(server).toHaveBeenCalledWith(request);
    expect(result.suggestions).toEqual(suggestions);
  });
});
