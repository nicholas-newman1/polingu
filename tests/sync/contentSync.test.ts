import { describe, expect, test, vi } from 'vitest';
import { loadContentData, syncContentFromFirestore } from '../../src/lib/offlineDb/contentSync';
import { contentDb } from '../../src/lib/offlineDb/contentDb';
import { remote } from './support/fakeFirestore';
import { freezeTime, network, setupSyncTests, signIn } from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

const sentence = (id: string, polish = 'Mam kota.') => ({
  id,
  polish,
  english: 'I have a cat.',
  level: 'A1',
  tags: [],
});

function seedServerContent() {
  remote.seed('sentences/a1_1', sentence('a1_1'));
  remote.seed('sentences/a1_2', sentence('a1_2'));
  remote.seed('verbs/robic', { id: 'robic', infinitive: 'robić' });
  remote.seed('vocabulary/1', { id: 1, polish: 'kot', english: 'cat' });
  remote.seed('declensionCards/1', { id: 1, front: 'Nie mam ___', declined: 'kota' });
}

const sentenceIds = (content: { sentences: Array<{ id: string }> }) =>
  content.sentences.map((s) => s.id).sort();

describe('loading built-in content', () => {
  test('on first run, downloads every collection and caches it for offline use', async () => {
    seedServerContent();

    const content = await loadContentData();

    expect(sentenceIds(content)).toEqual(['a1_1', 'a1_2']);
    expect(content.verbs).toEqual([{ id: 'robic', infinitive: 'robić' }]);
    expect(content.vocabulary).toEqual([{ id: 1, polish: 'kot', english: 'cat' }]);
    expect(content.declensionCards).toHaveLength(1);

    network.goOffline();
    expect(await loadContentData()).toEqual(content);
  });

  test('once cached, loads from the cache without calling the server', async () => {
    seedServerContent();
    await loadContentData();
    remote.seed('sentences/a1_3', sentence('a1_3'));
    remote.calls.length = 0;

    const content = await loadContentData();

    expect(sentenceIds(content)).toEqual(['a1_1', 'a1_2']);
    expect(remote.calls).toEqual([]);
  });

  test('is available to guests too', async () => {
    seedServerContent();
    expect(sentenceIds(await loadContentData())).toEqual(['a1_1', 'a1_2']);
  });

  test('offline on first run returns empty content without calling the server', async () => {
    network.goOffline();

    expect(await loadContentData()).toEqual({
      sentences: [],
      verbs: [],
      vocabulary: [],
      declensionCards: [],
    });
    expect(remote.calls).toEqual([]);
  });

  test('a server failure on first run returns empty content instead of throwing', async () => {
    seedServerContent();
    remote.fail({ op: 'getDocs', path: 'verbs' });

    expect(await loadContentData()).toEqual({
      sentences: [],
      verbs: [],
      vocabulary: [],
      declensionCards: [],
    });
  });
});

describe('background content sync', () => {
  test('replaces the cache with the server copy: edits applied, deletions removed, additions added', async () => {
    seedServerContent();
    await loadContentData();
    remote.seed('sentences/a1_1', sentence('a1_1', 'Mam psa.'));
    remote.remove('sentences/a1_2');
    remote.seed('sentences/a2_1', sentence('a2_1'));

    await syncContentFromFirestore();

    network.goOffline();
    const content = await loadContentData();
    expect(content.sentences.map((s) => [s.id, s.polish]).sort()).toEqual([
      ['a1_1', 'Mam psa.'],
      ['a2_1', 'Mam kota.'],
    ]);
  });

  test('records when the content was last synced', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    seedServerContent();

    await syncContentFromFirestore();

    expect(await contentDb.meta.get('lastSync')).toEqual({
      key: 'lastSync',
      value: Date.parse('2026-11-26T10:00:00-05:00'),
    });
  });

  test('a failed sync leaves the previous cache untouched', async () => {
    seedServerContent();
    await loadContentData();
    remote.remove('sentences/a1_1');
    remote.fail({ op: 'getDocs', path: 'declensionCards' });

    await expect(syncContentFromFirestore()).rejects.toThrow();

    network.goOffline();
    expect(sentenceIds(await loadContentData())).toEqual(['a1_1', 'a1_2']);
  });
});
