import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  callables,
  quiesce,
  renderApp,
  setupUiTests,
  waitForReviewData,
  LEARNER,
} from './support/app';
import {
  seedCustom,
  seedReviewedWord,
  sentence,
  serverItems,
  userPath,
  word,
} from './support/data';
import { remote } from './support/firestore';
import {
  findDialog,
  findSnackbar,
  press,
  querySnackbar,
  settle,
  type,
  waitForDialogsToClose,
} from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const UID = LEARNER.uid;

async function openQuickAdd() {
  renderApp('/dashboard');
  await screen.findByText('Dashboard page');
  await waitForReviewData();
  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }));
  return screen.getByRole('menu');
}

describe('Quick add button', () => {
  test('opens a menu offering a word or a sentence, and Escape closes it', async () => {
    renderApp('/dashboard');
    await screen.findByText('Dashboard page');
    const fab = screen.getByRole('button', { name: 'Quick add' });
    expect(fab).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menuitem', { name: 'Vocabulary' })).toBeNull();

    fireEvent.click(fab);
    expect(screen.getByRole('button', { name: 'Close quick add' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('menuitem', { name: 'Vocabulary' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sentence' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Quick add' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('menuitem', { name: 'Vocabulary' })).toBeNull();
  });

  test('a word added from anywhere is saved to My Vocabulary', async () => {
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    expect(within(dialog).getByRole('textbox', { name: 'Polish' })).toHaveValue('');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Pies');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'Dog');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await waitForDialogsToClose();
    await waitFor(() =>
      expect(Object.values(serverItems(UID, 'customVocabulary'))).toEqual([
        expect.objectContaining({ polish: 'pies', english: 'dog', isCustom: true }),
      ])
    );
  });

  test('a word that is already saved is reported instead of being added twice', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'pies', 'dog')]);
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'PIES');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'hound');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    expect(
      await findSnackbar('This Polish word is already in your custom vocabulary.')
    ).toBeInTheDocument();
    await settle();
    expect(Object.keys(serverItems(UID, 'customVocabulary'))).toEqual(['w1']);
  });

  test('a duplicate word keeps the dialog open with what was typed', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'pies', 'dog')]);
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'PIES');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'hound');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await findSnackbar('This Polish word is already in your custom vocabulary.');
    await settle(300);
    expect(screen.getByRole('dialog', { name: 'Add New Word' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'English' })).toHaveValue('hound');
  });

  describe('a word already in the built-in deck', () => {
    const BUILT_IN_DUPLICATE = 'This Polish word is already in the built-in deck.';

    async function addBuiltInDom() {
      remote.seed('vocabulary/79', { id: 79, polish: 'dom', english: 'house' });
      const menu = await openQuickAdd();
      // The start-up sync loads the built-in deck.
      await act(quiesce);
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
      const dialog = await findDialog('Add New Word');
      type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Dom ');
      type(within(dialog).getByRole('textbox', { name: 'English' }), 'home');
      await press(within(dialog).getByRole('button', { name: 'Add Word' }));
      return findSnackbar(BUILT_IN_DUPLICATE);
    }

    test('is refused and not saved', async () => {
      const snackbar = await addBuiltInDom();
      expect(
        within(snackbar).queryByRole('button', { name: 'Review again', hidden: true })
      ).toBeNull();
      await settle(300);
      expect(screen.getByRole('dialog', { name: 'Add New Word' })).toBeInTheDocument();
      expect(serverItems(UID, 'customVocabulary')).toEqual({});
    });

    test('offers "Review again" when studied, which requeues the built-in word', async () => {
      seedReviewedWord(UID, '79', 'pl-to-en');
      const snackbar = await addBuiltInDom();
      fireEvent.click(within(snackbar).getByRole('button', { name: 'Review again', hidden: true }));

      const reviewCard = userPath(UID, 'vocabularyReviewCards-pl-en', '79');
      await waitFor(() => expect(remote.get(reviewCard)).toMatchObject({ fsrsCard: { state: 0 } }));
      expect(querySnackbar('Word queued for review again.')).toBeInTheDocument();
      expect(serverItems(UID, 'customVocabulary')).toEqual({});
    });
  });

  test('a sentence added from anywhere is saved to My Sentences', async () => {
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sentence' }));
    const dialog = await findDialog('Add Sentence');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Pies szczeka.');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'The dog barks.');
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    await waitForDialogsToClose();
    await waitFor(() =>
      expect(Object.values(serverItems(UID, 'customSentences'))).toEqual([
        expect.objectContaining({ polish: 'Pies szczeka.', level: 'A1', isCustom: true }),
      ])
    );
  });

  test('a duplicate sentence is reported and not saved again', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Pies szczeka.', 'The dog barks.')]);
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sentence' }));
    const dialog = await findDialog('Add Sentence');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'pies szczeka.');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'Dog barks.');
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    expect(await findSnackbar('This sentence is already in your collection.')).toBeInTheDocument();
    await settle();
    expect(Object.keys(serverItems(UID, 'customSentences'))).toEqual(['s1']);
  });

  test('a duplicate sentence keeps the dialog open with what was typed', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Pies szczeka.', 'The dog barks.')]);
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Sentence' }));
    const dialog = await findDialog('Add Sentence');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'pies szczeka.');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'Dog barks.');
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    await findSnackbar('This sentence is already in your collection.');
    await settle(300);
    expect(screen.getByRole('dialog', { name: 'Add Sentence' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Polish' })).toHaveValue('pies szczeka.');
  });

  test('typing the Polish word fills in the English translation', async () => {
    callables.set<{ text: string; targetLang: string; vocabulary?: boolean }>(
      'translate',
      ({ text, targetLang }) => ({
        translatedText: text === 'pies' && targetLang === 'EN' ? 'dog' : '?',
        charsUsedToday: 4,
        resetTime: '',
      })
    );
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'pies');

    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'English' })).toHaveValue('dog')
    );
    expect(callables.callsTo('translate')).toEqual([
      { text: 'pies', targetLang: 'EN', vocabulary: true },
    ]);
  });

  test('an English word typed by hand is not overwritten by a translation', async () => {
    callables.set('translate', () => ({ translatedText: 'dog', charsUsedToday: 4, resetTime: '' }));
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'hound');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'pies');

    await settle(700);
    expect(within(dialog).getByRole('textbox', { name: 'English' })).toHaveValue('hound');
  });

  test('the clear button empties a field', async () => {
    const menu = await openQuickAdd();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Vocabulary' }));
    const dialog = await findDialog('Add New Word');
    const polish = within(dialog).getByRole('textbox', { name: 'Polish' });
    type(polish, 'pies');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear Polish' }));
    expect(polish).toHaveValue('');
    expect(within(dialog).queryByRole('button', { name: 'Clear Polish' })).toBeNull();
  });
});
