import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callables,
  quiesce,
  renderApp,
  setupUiTests,
  waitForReviewData,
  ADMIN,
} from './support/app';
import { seedCustom, sentence, userPath } from './support/data';
import { remote } from './support/firestore';
import { findDialog, findSnackbar, press, type, waitForDialogsToClose } from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const sizes = ['offsetHeight', 'offsetWidth'] as const;
const originalSizes = sizes.map((key) =>
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)
);

beforeEach(() => {
  // The admin lists are virtualised: give their scroll boxes a size so rows render.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 500 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});

afterEach(() => {
  sizes.forEach((key, i) => {
    const original = originalSizes[i];
    if (original) Object.defineProperty(HTMLElement.prototype, key, original);
    else delete (HTMLElement.prototype as Partial<Record<(typeof sizes)[number], number>>)[key];
  });
});

function seedBuiltInContent() {
  remote.seed('vocabulary/1', { id: 1, polish: 'kot', english: 'cat', partOfSpeech: 'noun' });
  remote.seed('vocabulary/2', { id: 2, polish: 'pies', english: 'dog' });
  remote.seed('sentences/b1_007', {
    id: 'b1_007',
    polish: 'Jutro pojadę do Krakowa.',
    english: 'Tomorrow I will go to Kraków.',
    level: 'B1',
    tags: ['travel'],
  });
  remote.seed('declensionCards/1', {
    id: 1,
    front: 'Nie mam ___.',
    back: 'Nie mam kota.',
    declined: 'kota',
    english: "I don't have a cat.",
    case: 'Genitive',
    gender: 'Masculine',
    number: 'Singular',
    hint: 'nie + genitive',
  });
  remote.seed('verbs/robic', {
    id: 'robic',
    infinitive: 'robić',
    infinitiveEn: 'to do',
    aspect: 'Imperfective',
    verbClass: '-ić',
    isIrregular: false,
    isReflexive: false,
    aspectPair: 'zrobic',
    conjugations: { present: { '1sg': { pl: 'robię', en: ['I do'] } } },
  });
  remote.seed('config/sentenceTags', { topics: ['travel', 'food'], grammar: [], style: [] });
}

async function openContent(tab = 'vocabulary') {
  seedBuiltInContent();
  const app = renderApp(`/admin/content/${tab}`, { account: ADMIN });
  await screen.findByRole('tab', { name: /^Vocabulary/ });
  await waitForReviewData();
  // Let the start-up sync finish: it reloads the built-in lists when it completes.
  await act(quiesce);
  return app;
}

/** Confirms the dialog titled `title` with its `confirmLabel` button, after checking its message. */
async function confirmDialog(title: string, message: string | RegExp, confirmLabel = 'Delete') {
  const confirmation = await findDialog(title);
  expect(confirmation).toHaveTextContent(message);
  fireEvent.click(within(confirmation).getByRole('button', { name: confirmLabel }));
}

/** The row in an admin list showing `text`. */
const listRow = (text: string) =>
  screen.getByText(text, { exact: false }).closest('[data-index]') as HTMLElement;

describe('Built-in content editor', () => {
  test('tabs count each kind of content and switch the address', async () => {
    const app = await openContent();
    expect(await screen.findByRole('tab', { name: 'Vocabulary (2)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Declensions (1)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Verbs (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Sentences (1)' }));
    await waitFor(() => expect(app.location()).toBe('/admin/content/sentences'));
    expect(await screen.findByText('Jutro pojadę do Krakowa.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Declensions (1)' }));
    expect(await screen.findByText('kota')).toBeInTheDocument();
  });

  test('searching narrows the list', async () => {
    await openContent();
    await screen.findByText('Showing 2 of 2 words');
    type(screen.getByPlaceholderText('Search vocabulary...'), 'DOG');
    expect(await screen.findByText('Showing 1 of 2 words')).toBeInTheDocument();
    expect(screen.queryByText('kot')).toBeNull();
    type(screen.getByPlaceholderText('Search vocabulary...'), 'zebra');
    expect(await screen.findByText('No words match your search')).toBeInTheDocument();
  });

  test('editing a built-in word saves the change for everyone', async () => {
    await openContent();
    fireEvent.click(await screen.findByText('kot'));
    const dialog = await findDialog('Edit Word');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'tomcat');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar('Word updated')).toBeInTheDocument();
    await waitForDialogsToClose();
    expect(remote.get('vocabulary/1')).toMatchObject({ english: 'tomcat', partOfSpeech: 'noun' });
    expect(within(listRow('kot')).getByText(/tomcat/)).toBeInTheDocument();
  });

  test('a built-in word’s regenerated audio plays from the list without being saved twice', async () => {
    callables.set('generateAudioPreview', () => ({ audioBase64: 'AAAA' }));
    callables.set('saveAudio', () => ({ audioUrl: 'https://audio.test/kot.mp3' }));
    await openContent();
    await screen.findByText('kot');
    expect(within(listRow('kot')).queryByTestId('VolumeUpIcon')).toBeNull();
    fireEvent.click(screen.getByText('kot'));
    const dialog = await findDialog('Edit Word');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Generate Audio' }));

    await waitForDialogsToClose();
    expect(await within(listRow('kot')).findByTestId('VolumeUpIcon')).toBeInTheDocument();
    expect(callables.callsTo('saveAudio')).toEqual([
      { audioBase64: 'AAAA', type: 'vocabulary', id: '1' },
    ]);
    // saveAudio already stored the URL on the word.
    expect(remote.callsTo('updateDoc', 'setDoc')).not.toContain('updateDoc vocabulary/1');
  });

  test('deleting a built-in word asks first and removes it', async () => {
    await openContent();
    await screen.findByText('kot');
    fireEvent.click(within(listRow('kot')).getByTestId('DeleteIcon').closest('button')!);

    await confirmDialog('Delete Word', 'Delete "kot"?');
    expect(await findSnackbar('Word deleted')).toBeInTheDocument();
    expect(remote.get('vocabulary/1')).toBeUndefined();
    expect(screen.getByText('Showing 1 of 1 words')).toBeInTheDocument();
  });

  test('a delete the server refuses is reported and the word stays', async () => {
    await openContent();
    await screen.findByText('kot');
    remote.fail({ op: 'deleteDoc', path: 'vocabulary' });
    fireEvent.click(within(listRow('kot')).getByTestId('DeleteIcon').closest('button')!);
    await confirmDialog('Delete Word', 'Delete "kot"?');

    expect(await findSnackbar('Failed to delete word')).toBeInTheDocument();
    expect(screen.getByText('kot')).toBeInTheDocument();
  });

  test('clearing a built-in card’s hint removes it', async () => {
    await openContent('declensions');
    fireEvent.click(await screen.findByText('kota'));
    const dialog = await findDialog('Edit Declension Card');
    const hint = within(dialog).getByRole('textbox', { name: 'Hint (optional)' });
    expect(hint).toHaveValue('nie + genitive');
    type(hint, '');
    type(within(dialog).getByRole('textbox', { name: 'Declined Word' }), 'kotka');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar('Card updated')).toBeInTheDocument();
    expect(remote.get('declensionCards/1')).toMatchObject({ declined: 'kotka' });
    expect(remote.get('declensionCards/1')).not.toHaveProperty('hint');
  });

  test('editing a verb saves it for everyone, and an emptied aspect pair is removed', async () => {
    await openContent('verbs');
    fireEvent.click(await screen.findByText('robić'));
    const dialog = await findDialog('Edit Verb');
    expect(within(dialog).getByRole('textbox', { name: 'Aspect Pair (optional)' })).toHaveValue(
      'zrobic'
    );
    type(within(dialog).getByRole('textbox', { name: 'English Infinitive' }), ' to make ');
    type(within(dialog).getByRole('textbox', { name: 'Aspect Pair (optional)' }), '');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar('Verb updated')).toBeInTheDocument();
    const saved = remote.get('verbs/robic');
    expect(saved).toMatchObject({ infinitive: 'robić', infinitiveEn: 'to make' });
    expect(saved).not.toHaveProperty('aspectPair');
    expect(saved?.conjugations).toEqual({ present: { '1sg': { pl: 'robię', en: ['I do'] } } });
    await waitForDialogsToClose();
    expect(within(listRow('robić')).getByText(/to make/)).toBeInTheDocument();
  });

  test('closing a verb without saving discards the edits', async () => {
    await openContent('verbs');
    fireEvent.click(await screen.findByText('robić'));
    let dialog = await findDialog('Edit Verb');
    type(within(dialog).getByRole('textbox', { name: 'Polish Infinitive' }), 'zrobić');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitForDialogsToClose();

    fireEvent.click(screen.getByText('robić'));
    dialog = await findDialog('Edit Verb');
    expect(within(dialog).getByRole('textbox', { name: 'Polish Infinitive' })).toHaveValue('robić');
    expect(remote.callsTo('updateDoc', 'setDoc').filter((call) => call.includes('verbs/'))).toEqual(
      []
    );
  });

  test('a verb can be deleted from its edit dialog', async () => {
    await openContent('verbs');
    fireEvent.click(await screen.findByText('robić'));
    const dialog = await findDialog('Edit Verb');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Verb' }));
    await confirmDialog('Delete Verb', /Delete this verb and all its conjugation forms/);

    expect(await findSnackbar('Verb deleted')).toBeInTheDocument();
    expect(remote.get('verbs/robic')).toBeUndefined();
  });
});

describe('Sentence generator', () => {
  async function openGenerator() {
    seedBuiltInContent();
    renderApp('/admin/generator', { account: ADMIN });
    await screen.findByRole('tab', { name: 'Generate' });
    await waitForReviewData();
    await act(quiesce);
  }

  const generated = [
    { polish: 'Lubię pierogi.', english: 'I like pierogi.', level: 'B1', tags: ['food'] },
    { polish: 'Jem zupę.', english: 'I am eating soup.', level: 'B1', tags: ['food'] },
  ];

  test('generated sentences can be picked and are saved under the next free ids', async () => {
    callables.set('generateSentences', () => ({ sentences: generated }));
    await openGenerator();
    fireEvent.click(await screen.findByText('food (0)'));
    type(screen.getByRole('spinbutton', { name: 'Number of sentences' }), '2');
    type(screen.getByRole('textbox', { name: 'Guidance (optional)' }), ' at a restaurant ');
    fireEvent.click(screen.getByRole('button', { name: 'Generate 2 Sentences' }));

    expect(await screen.findByText('Generated Sentences (2 selected)')).toBeInTheDocument();
    expect(callables.callsTo('generateSentences')).toEqual([
      { level: 'B1', tags: ['food'], count: 2, guidance: 'at a restaurant' },
    ]);
    fireEvent.click(screen.getByText('Jem zupę.'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 Sentences' }));

    expect(await findSnackbar('Saved 1 sentences')).toBeInTheDocument();
    expect(remote.get('sentences/b1_008')).toMatchObject({
      id: 'b1_008',
      polish: 'Lubię pierogi.',
      level: 'B1',
      tags: ['food'],
    });
    expect(screen.getByText('Generated Sentences (0 selected)')).toBeInTheDocument();
    expect(screen.getByText('Jem zupę.')).toBeInTheDocument();
    expect(screen.queryByText('Lubię pierogi.')).toBeNull();
  });

  test('a failed generation is reported', async () => {
    callables.set('generateSentences', () => {
      throw new Error('overloaded');
    });
    await openGenerator();
    fireEvent.click(screen.getByRole('button', { name: 'Generate 5 Sentences' }));
    expect(await findSnackbar('Generation failed. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate 5 Sentences' })).toBeEnabled();
  });

  test('a sentence typed by hand is translated, assessed, and saved after editing', async () => {
    callables.set('processSentence', () => ({
      polish: 'Idę do domu.',
      english: 'I go home.',
      level: 'A1',
    }));
    await openGenerator();
    fireEvent.click(screen.getByRole('tab', { name: 'Add Custom' }));
    type(await screen.findByRole('textbox', { name: 'Polish Sentence' }), 'Idę do domu');
    fireEvent.click(screen.getByRole('button', { name: 'Translate & Assess' }));

    const english = await screen.findByRole('textbox', { name: 'English' });
    expect(english).toHaveValue('I go home.');
    expect(callables.callsTo('processSentence')).toEqual([
      { text: 'Idę do domu', sourceLang: 'PL' },
    ]);
    type(english, "I'm going home.");
    fireEvent.click(screen.getByText('travel'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Sentence' }));

    expect(await findSnackbar('Sentence saved!')).toBeInTheDocument();
    expect(remote.get('sentences/a1_001')).toMatchObject({
      polish: 'Idę do domu.',
      english: "I'm going home.",
      level: 'A1',
      tags: ['travel'],
    });
    expect(screen.getByRole('textbox', { name: 'Polish Sentence' })).toHaveValue('');
  });

  test('the browse tab filters by level and tag and deletes sentences', async () => {
    await openGenerator();
    fireEvent.click(screen.getByRole('tab', { name: 'Browse (1)' }));
    expect(await screen.findByText('Showing 1 of 1 sentences')).toBeInTheDocument();
    fireEvent.click(screen.getByText('A1 (0)'));
    expect(screen.getByText('Showing 0 of 1 sentences')).toBeInTheDocument();
    fireEvent.click(screen.getByText('All Levels'));
    fireEvent.click(screen.getByText('travel (1)'));
    expect(screen.getByText('Showing 1 of 1 sentences')).toBeInTheDocument();

    fireEvent.click(within(listRow('Jutro pojadę')).getByTestId('DeleteIcon').closest('button')!);
    await confirmDialog('Delete Sentence', 'Delete this sentence?');
    expect(await findSnackbar('Sentence deleted')).toBeInTheDocument();
    expect(remote.get('sentences/b1_007')).toBeUndefined();
    expect(screen.getByText('Showing 0 of 0 sentences')).toBeInTheDocument();
    expect(screen.queryByText('Jutro pojadę do Krakowa.')).toBeNull();
  });

  test('deleting one of the admin’s own sentences in Browse removes it', async () => {
    seedCustom(ADMIN.uid, 'customSentences', [sentence('custom_1', 'Mój kot.', 'My cat.')]);
    await openGenerator();
    fireEvent.click(await screen.findByRole('tab', { name: 'Browse (2)' }));
    await screen.findByText('Mój kot.');
    fireEvent.click(within(listRow('Mój kot.')).getByTestId('DeleteIcon').closest('button')!);
    await confirmDialog('Delete Sentence', 'Delete this sentence?');

    expect(await findSnackbar('Sentence deleted')).toBeInTheDocument();
    expect(remote.get(userPath(ADMIN.uid, 'customSentences', 'custom_1'))).toBeUndefined();
    expect(screen.queryByText('Mój kot.')).toBeNull();
  });

  test('curriculum suggestions can be added as tags', async () => {
    callables.set('discoverCurriculum', () => ({
      suggestions: [
        {
          tag: 'weather',
          category: 'topics',
          priority: 'high',
          explanation: 'Small talk needs it.',
          exampleConcepts: ['rain'],
          relevantLevels: ['A2'],
        },
      ],
    }));
    await openGenerator();
    fireEvent.click(screen.getByRole('tab', { name: 'Curriculum' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discover Missing Concepts' }));
    expect(await screen.findByText('Small talk needs it.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }));
    expect(await findSnackbar('Added "weather" to topics')).toBeInTheDocument();
    await waitFor(() =>
      expect(remote.get('config/sentenceTags')).toMatchObject({
        topics: ['travel', 'food', 'weather'],
      })
    );
  });

  test('"Generate" on a suggestion generates for its level and tag', async () => {
    callables.set('discoverCurriculum', () => ({
      suggestions: [
        {
          tag: 'food',
          category: 'topics',
          priority: 'high',
          explanation: 'Ordering in restaurants.',
          exampleConcepts: [],
          relevantLevels: ['A2'],
        },
      ],
    }));
    callables.set('generateSentences', () => ({ sentences: [] }));
    await openGenerator();
    fireEvent.click(screen.getByRole('tab', { name: 'Curriculum' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discover Missing Concepts' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Generate' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Generate 5 Sentences' }));

    await waitFor(() => expect(callables.callsTo('generateSentences')).toHaveLength(1));
    expect(callables.callsTo('generateSentences')[0]).toMatchObject({
      level: 'A2',
      tags: ['food'],
    });
  });

  test('saving generated sentences does not duplicate the admin’s own sentences', async () => {
    seedCustom(ADMIN.uid, 'customSentences', [sentence('custom_1', 'Mój kot.', 'My cat.')]);
    callables.set('generateSentences', () => ({ sentences: [generated[0]] }));
    await openGenerator();
    expect(await screen.findByRole('tab', { name: 'Browse (2)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate 5 Sentences' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save 1 Sentences' }));
    await findSnackbar('Saved 1 sentences');
    expect(remote.get('sentences/b1_008')).toMatchObject({ polish: 'Lubię pierogi.' });

    expect(screen.getByRole('tab', { name: /^Browse/ })).toHaveTextContent('Browse (3)');
  });
});
