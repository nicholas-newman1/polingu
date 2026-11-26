import { describe, expect, test, vi } from 'vitest';
import { remote } from '../sync/support/fakeFirestore';
import { setupSyncTests } from '../sync/support/harness';
import { loadSentenceTags } from '../../src/lib/storage/sentenceTags';
import { renderReviewProviders, SAVE_ERROR } from './support/render';
import { freshUid } from './support/fixtures';

vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));

setupSyncTests();

const TAGS_DOC = 'config/sentenceTags';
const INITIAL_TAGS = { topics: ['food'], grammar: ['aspect'], style: [] };

function renderTags() {
  const h = renderReviewProviders(freshUid(), { sentences: { initialTags: INITIAL_TAGS } });
  return { h, tags: () => h.data().sentenceTags };
}

describe('sentence tags', () => {
  test('start from the loaded tags, or empty categories when none were loaded', () => {
    expect(renderTags().tags()).toEqual(INITIAL_TAGS);

    const h = renderReviewProviders(null);
    expect(h.data().sentenceTags).toEqual({ topics: [], grammar: [], style: [] });
  });

  test('an added tag shows at once and the whole set is saved, on the server and on the device', async () => {
    const { h, tags } = renderTags();

    await h.run(() => h.data().addSentenceTag('topics', 'travel'));

    const expected = { ...INITIAL_TAGS, topics: ['food', 'travel'] };
    expect(tags()).toEqual(expected);
    expect(remote.get(TAGS_DOC)).toEqual(expected);
    expect(await loadSentenceTags()).toEqual(expected);
  });

  test('adding a tag the category already has changes and saves nothing', async () => {
    const { h, tags } = renderTags();

    await h.run(() => h.data().addSentenceTag('topics', 'food'));

    expect(tags()).toEqual(INITIAL_TAGS);
    expect(remote.callsTo('setDoc')).toEqual([]);
  });

  test('tags added one after another are all kept', async () => {
    const { h, tags } = renderTags();

    await h.run(() => h.data().addSentenceTag('topics', 'travel'));
    await h.run(() => h.data().addSentenceTag('style', 'formal'));

    const expected = { topics: ['food', 'travel'], grammar: ['aspect'], style: ['formal'] };
    expect(tags()).toEqual(expected);
    expect(remote.get(TAGS_DOC)).toEqual(expected);
  });

  test('a removed tag disappears at once and the set without it is saved', async () => {
    const { h, tags } = renderTags();

    await h.run(() => h.data().removeSentenceTag('grammar', 'aspect'));

    expect(tags()).toEqual({ ...INITIAL_TAGS, grammar: [] });
    expect(remote.get(TAGS_DOC)).toEqual({ ...INITIAL_TAGS, grammar: [] });
  });

  test('changes the server rejects stay shown and each failure is reported', async () => {
    const { h, tags } = renderTags();
    remote.fail({ op: 'setDoc', path: TAGS_DOC });

    await h.run(() => h.data().addSentenceTag('topics', 'travel'));
    await h.run(() => h.data().removeSentenceTag('grammar', 'aspect'));

    expect(tags()).toEqual({ topics: ['food', 'travel'], grammar: [], style: [] });
    expect(h.errors()).toEqual([SAVE_ERROR, SAVE_ERROR]);
  });
});
