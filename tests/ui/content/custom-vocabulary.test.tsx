import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { quiesce, renderApp, setupUiTests, waitForReviewData, LEARNER, ADMIN } from './support/app';
import {
  daysAfterBase,
  seedCustom,
  seedReviewedWord,
  serverItems,
  userPath,
  word,
} from './support/data';
import { remote } from './support/firestore';
import { network } from '../../sync/support/harness';
import {
  choose,
  columnValues,
  expectDialogToStayOpen,
  findDialog,
  findSnackbar,
  press,
  querySnackbar,
  rowWith,
  selectFor,
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
const DUPLICATE = 'This Polish word is already in your custom vocabulary.';
const BUILT_IN_DUPLICATE = 'This Polish word is already in the built-in deck.';
const SAVE_FAILED = 'Failed to save. Please try again.';

async function openPage(account = LEARNER) {
  const app = renderApp('/my-vocabulary', { account });
  await screen.findByRole('heading', { name: 'My Vocabulary', level: 5 });
  return app;
}

async function openAddDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Word' }));
  return findDialog('Add New Word');
}

function fillWord(dialog: HTMLElement, polish: string, english: string) {
  type(within(dialog).getByRole('textbox', { name: 'Polish' }), polish);
  type(within(dialog).getByRole('textbox', { name: 'English' }), english);
}

const serverWords = () => Object.values(serverItems(UID, 'customVocabulary'));

/** Answers the "Delete Word" confirmation with `answer`. */
async function answerDeleteConfirmation(answer: 'Delete' | 'Cancel') {
  const confirmation = await findDialog('Delete Word');
  expect(confirmation).toHaveTextContent('Are you sure you want to delete this word?');
  fireEvent.click(within(confirmation).getByRole('button', { name: answer }));
}

async function editRow(polish: string) {
  await screen.findByText(polish);
  fireEvent.click(within(rowWith(polish)).getByRole('button', { name: 'edit word' }));
}

describe('My Vocabulary list', () => {
  test('shows an empty state with a way to add the first word', async () => {
    await openPage();
    expect(screen.getByText('No custom words yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Your First Word' }));
    expect(await findDialog('Add New Word')).toBeInTheDocument();
  });

  test('lists the words saved on the server with their details and a count', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat', { partOfSpeech: 'noun', gender: 'masculine', notes: 'a pet' }),
      word('w2', 'biegać', 'to run', { partOfSpeech: 'verb' }),
    ]);
    await openPage();

    const kot = await screen.findByText('kot');
    const row = kot.closest('tr')!;
    expect(within(row).getByText('cat')).toBeInTheDocument();
    expect(within(row).getByText('noun')).toBeInTheDocument();
    expect(within(row).getByText('masculine')).toBeInTheDocument();
    expect(within(row).getByText('a pet')).toBeInTheDocument();
    expect(within(row).getByText('Nov 1, 2026')).toBeInTheDocument();
    const header = screen.getByRole('heading', { name: 'My Vocabulary', level: 5 }).parentElement!
      .parentElement!;
    expect(within(header).getByText('2')).toBeInTheDocument();
  });

  test('only admins get an audio column', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    const app = await openPage();
    await screen.findByText('kot');
    expect(screen.queryByRole('columnheader', { name: 'Audio' })).toBeNull();
    app.unmount();

    seedCustom(ADMIN.uid, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    await openPage(ADMIN);
    expect(await screen.findByRole('columnheader', { name: 'Audio' })).toBeInTheDocument();
  });
});

describe('Adding a word', () => {
  test('lists it at once, before the server has confirmed, and saves it lower-cased', async () => {
    await openPage();
    const write = remote.hold('setDoc');
    const dialog = await openAddDialog();
    fillWord(dialog, ' Kot ', 'Cat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await waitForDialogsToClose();
    expect(await screen.findByText('kot')).toBeInTheDocument();
    expect(screen.getByText('cat')).toBeInTheDocument();

    write.release();
    await waitFor(() => expect(serverWords()).toHaveLength(1));
    expect(serverWords()[0]).toMatchObject({ polish: 'kot', english: 'cat', isCustom: true });
  });

  test('the Add button stays disabled until both Polish and English are filled in', async () => {
    await openPage();
    const dialog = await openAddDialog();
    const add = within(dialog).getByRole('button', { name: 'Add Word' });
    expect(add).toBeDisabled();
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'kot');
    type(within(dialog).getByRole('textbox', { name: 'English' }), '   ');
    await settle();
    expect(add).toBeDisabled();
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'cat');
    await waitFor(() => expect(add).toBeEnabled());
  });

  test('saves the optional part of speech, gender, notes and examples', async () => {
    await openPage();
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More details (optional)' }));
    await choose('Part of Speech (optional)', 'Noun', dialog);
    await choose('Gender (optional)', 'Masculine', dialog);
    type(within(dialog).getByRole('textbox', { name: 'Notes (optional)' }), ' animal ');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add manually' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add manually' }));
    const polishFields = within(dialog).getAllByPlaceholderText('e.g., Mam czarnego kota.');
    const englishFields = within(dialog).getAllByPlaceholderText('e.g., I have a black cat.');
    type(polishFields[0], 'Mam kota.');
    type(englishFields[0], 'I have a cat.');
    // The second example is left empty and must not be saved.
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await waitFor(() => expect(serverWords()).toHaveLength(1));
    const saved = serverWords()[0];
    expect(saved).toMatchObject({
      polish: 'kot',
      partOfSpeech: 'noun',
      gender: 'masculine',
      notes: 'animal',
    });
    expect(saved.examples).toEqual([
      expect.objectContaining({ polish: 'Mam kota.', english: 'I have a cat.' }),
    ]);
  });

  test('gender is only asked for nouns and is dropped when the word stops being one', async () => {
    await openPage();
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    fireEvent.click(within(dialog).getByRole('button', { name: 'More details (optional)' }));
    expect(within(dialog).queryByText('Gender (optional)', { selector: 'label' })).toBeNull();

    await choose('Part of Speech (optional)', 'Noun', dialog);
    await choose('Gender (optional)', 'Feminine', dialog);
    await choose('Part of Speech (optional)', 'Adjective', dialog);
    expect(within(dialog).queryByText('Gender (optional)', { selector: 'label' })).toBeNull();
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    await waitFor(() => expect(serverWords()).toHaveLength(1));
    expect(serverWords()[0].partOfSpeech).toBe('adjective');
    expect(serverWords()[0]).not.toHaveProperty('gender');
  });

  test('a Polish word already in the list is refused and the dialog keeps what was typed', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    await openPage();
    await screen.findByText('kot');
    const dialog = await openAddDialog();
    fillWord(dialog, '  KOT ', 'tomcat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    const snackbar = await findSnackbar(DUPLICATE);
    // The open dialog hides the rest of the page from queries, so look past that.
    expect(
      within(snackbar).queryByRole('button', { name: 'Review again', hidden: true })
    ).toBeNull();
    const stillOpen = await expectDialogToStayOpen('Add New Word');
    expect(within(stillOpen).getByRole('textbox', { name: 'English' })).toHaveValue('tomcat');
    expect(serverWords()).toHaveLength(1);
  });

  async function addDuplicateOfStudiedWord() {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    seedReviewedWord(UID, 'w1', 'en-to-pl');
    await openPage();
    // Once the review data has loaded, the row offers "review word again" too.
    await screen.findByText('kot');
    await within(rowWith('kot')).findByRole('button', { name: 'review word again' });
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));
    const snackbar = await findSnackbar(DUPLICATE);
    // The open dialog hides the rest of the page from queries, so look past that.
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Review again', hidden: true }));
  }

  test('the duplicate warning offers "Review again" for a studied word, which requeues it', async () => {
    await addDuplicateOfStudiedWord();
    const reviewCard = userPath(UID, 'vocabularyReviewCards-en-pl', 'w1');
    await waitFor(() => expect(remote.get(reviewCard)).toMatchObject({ fsrsCard: { state: 0 } }));
  });

  test('"Review again" in the duplicate warning confirms the word was requeued', async () => {
    await addDuplicateOfStudiedWord();
    const reviewCard = userPath(UID, 'vocabularyReviewCards-en-pl', 'w1');
    await waitFor(() => expect(remote.get(reviewCard)).toMatchObject({ fsrsCard: { state: 0 } }));
    expect(querySnackbar('Word queued for review again.')).toBeInTheDocument();
  });

  /** Opens the page once the built-in deck, which has "dom" (id 79), has loaded. */
  async function openPageWithBuiltInDom() {
    remote.seed('vocabulary/79', { id: 79, polish: 'dom', english: 'house' });
    await openPage();
    await waitForReviewData();
    await act(quiesce);
  }

  test('a word already in the built-in deck is refused, ignoring case and spacing', async () => {
    await openPageWithBuiltInDom();
    const dialog = await openAddDialog();
    fillWord(dialog, ' DOM ', 'home');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    const snackbar = await findSnackbar(BUILT_IN_DUPLICATE);
    // Never studied, so there is nothing to review again; it can be studied next instead.
    expect(
      within(snackbar).queryByRole('button', { name: 'Review again', hidden: true })
    ).toBeNull();
    expect(
      within(snackbar).getByRole('button', { name: 'Study next', hidden: true })
    ).toBeInTheDocument();
    await expectDialogToStayOpen('Add New Word');
    expect(serverWords()).toHaveLength(0);
  });

  test('"Study next" on a built-in word never studied puts it first in both directions', async () => {
    await openPageWithBuiltInDom();
    const dialog = await openAddDialog();
    fillWord(dialog, 'dom', 'house');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    const snackbar = await findSnackbar(BUILT_IN_DUPLICATE);
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Study next', hidden: true }));

    for (const collection of ['vocabularyReviewCards-pl-en', 'vocabularyReviewCards-en-pl']) {
      const reviewCard = userPath(UID, collection, '79');
      await waitFor(() =>
        expect(remote.get(reviewCard)).toMatchObject({
          fsrsCard: { state: 0 },
          prioritizedAt: expect.any(Number),
        })
      );
    }
    expect(querySnackbar('Word moved to the front of your new words.')).toBeInTheDocument();
    expect(serverWords()).toHaveLength(0);
  });

  test('the built-in duplicate warning offers "Review again" for a studied word, which requeues it', async () => {
    seedReviewedWord(UID, '79', 'en-to-pl');
    await openPageWithBuiltInDom();
    const dialog = await openAddDialog();
    fillWord(dialog, 'dom', 'house');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    const snackbar = await findSnackbar(BUILT_IN_DUPLICATE);
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Review again', hidden: true }));

    const reviewCard = userPath(UID, 'vocabularyReviewCards-en-pl', '79');
    await waitFor(() => expect(remote.get(reviewCard)).toMatchObject({ fsrsCard: { state: 0 } }));
    expect(querySnackbar('Word queued for review again.')).toBeInTheDocument();
    expect(serverWords()).toHaveLength(0);
  });

  test('a save the server rejects is taken back out of the list with an error', async () => {
    await openPage();
    remote.fail({ op: 'setDoc', path: /customVocabulary/ });
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    expect(await findSnackbar(SAVE_FAILED)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('kot')).toBeNull());
    expect(screen.getByText('No custom words yet')).toBeInTheDocument();
  });

  test('a word whose save failed is not listed again on the next visit', async () => {
    const app = await openPage();
    remote.fail({ op: 'setDoc', path: /customVocabulary/ });
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));
    expect(await findSnackbar(SAVE_FAILED)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('kot')).toBeNull());
    app.unmount();

    await openPage();
    await waitForReviewData();
    await act(quiesce);
    expect(serverWords()).toHaveLength(0);
    expect(screen.queryByText('kot')).toBeNull();
  });
});

describe('Editing a word', () => {
  test('opens with the saved details and updates the row and the server', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat', { notes: 'pet' })]);
    await openPage();
    await editRow('kot');
    const dialog = await findDialog('Edit Word');
    expect(within(dialog).getByRole('textbox', { name: 'Polish' })).toHaveValue('kot');
    expect(within(dialog).getByRole('textbox', { name: 'Notes (optional)' })).toHaveValue('pet');

    type(within(dialog).getByRole('textbox', { name: 'English' }), 'house cat');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitForDialogsToClose();
    expect(within(rowWith('kot')).getByText('house cat')).toBeInTheDocument();
    await waitFor(() =>
      expect(serverItems(UID, 'customVocabulary').w1).toMatchObject({ english: 'house cat' })
    );
  });

  test('clearing the optional details removes them from the saved word', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat', {
        partOfSpeech: 'noun',
        gender: 'masculine',
        notes: 'pet',
        examples: [{ id: 'e1', polish: 'Mam kota.', english: 'I have a cat.' }],
      }),
    ]);
    await openPage();
    await editRow('kot');
    const dialog = await findDialog('Edit Word');
    await choose('Part of Speech (optional)', 'None', dialog);
    type(within(dialog).getByRole('textbox', { name: 'Notes (optional)' }), '');
    fireEvent.click(within(dialog).getByRole('button', { name: 'remove example' }));
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      const saved = serverItems(UID, 'customVocabulary').w1;
      expect(saved).not.toHaveProperty('notes');
      expect(saved).not.toHaveProperty('partOfSpeech');
      expect(saved).not.toHaveProperty('gender');
      expect(saved).not.toHaveProperty('examples');
    });
    await waitForDialogsToClose();
    const row = rowWith('kot');
    expect(within(row).queryByText('noun')).toBeNull();
    expect(within(row).queryByText('pet')).toBeNull();
  });

  test('renaming a word to one already in the list is refused', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat'),
      word('w2', 'pies', 'dog', { createdAt: daysAfterBase(1) }),
    ]);
    await openPage();
    await editRow('pies');
    const dialog = await findDialog('Edit Word');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Kot');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar(DUPLICATE)).toBeInTheDocument();
    const stillOpen = await expectDialogToStayOpen('Edit Word');
    expect(within(stillOpen).getByRole('textbox', { name: 'Polish' })).toHaveValue('Kot');
    expect(serverItems(UID, 'customVocabulary').w2).toMatchObject({ polish: 'pies' });
  });
});

describe('Deleting a word', () => {
  test('asks for confirmation, then removes it from the list and the server', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    await openPage();
    await screen.findByText('kot');

    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'delete word' }));
    await answerDeleteConfirmation('Cancel');
    await waitForDialogsToClose();
    expect(screen.getByText('kot')).toBeInTheDocument();
    expect(serverWords()).toHaveLength(1);

    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'delete word' }));
    await answerDeleteConfirmation('Delete');
    await waitFor(() => expect(screen.queryByText('kot')).toBeNull());
    await waitFor(() => expect(serverWords()).toHaveLength(0));
  });

  test('a word added while a delete is still saving does not bring the deleted word back', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    await openPage();
    await screen.findByText('kot');
    const deletion = remote.hold('deleteDoc');
    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'delete word' }));
    await answerDeleteConfirmation('Delete');
    await waitForDialogsToClose();
    expect(screen.queryByText('kot')).toBeNull();

    const dialog = await openAddDialog();
    fillWord(dialog, 'pies', 'dog');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));
    await waitForDialogsToClose();
    expect(await screen.findByText('pies')).toBeInTheDocument();
    await act(quiesce);
    expect(screen.queryByText('kot')).toBeNull();

    deletion.release();
    await act(quiesce);
    expect(serverWords()).toEqual([expect.objectContaining({ polish: 'pies' })]);
    expect(screen.queryByText('kot')).toBeNull();
    expect(screen.getByText('pies')).toBeInTheDocument();
  });

  test('a delete the server rejects puts the word back with an error', async () => {
    seedCustom(UID, 'customVocabulary', [word('w1', 'kot', 'cat')]);
    await openPage();
    await screen.findByText('kot');
    remote.fail({ op: 'deleteDoc', path: /customVocabulary/ });

    fireEvent.click(within(rowWith('kot')).getByRole('button', { name: 'delete word' }));
    await answerDeleteConfirmation('Delete');

    expect(await findSnackbar(SAVE_FAILED)).toBeInTheDocument();
    expect(await screen.findByText('kot')).toBeInTheDocument();
    expect(serverWords()).toHaveLength(1);
  });
});

describe('Review again', () => {
  test('is offered only for studied words and requeues the word in every direction', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat'),
      word('w2', 'pies', 'dog', { createdAt: daysAfterBase(1) }),
    ]);
    seedReviewedWord(UID, 'w1', 'pl-to-en');
    seedReviewedWord(UID, 'w1', 'en-to-pl');
    await openPage();
    await screen.findByText('kot');

    const again = await within(rowWith('kot')).findByRole('button', { name: 'review word again' });
    expect(within(rowWith('pies')).queryByRole('button', { name: 'review word again' })).toBeNull();

    fireEvent.click(again);
    expect(await findSnackbar('Word queued for review again.')).toBeInTheDocument();
    await waitFor(() => {
      for (const dir of ['pl-en', 'en-pl']) {
        expect(remote.get(userPath(UID, `vocabularyReviewCards-${dir}`, 'w1'))).toMatchObject({
          fsrsCard: { state: 0 },
        });
      }
    });
    await waitFor(() =>
      expect(within(rowWith('kot')).queryByRole('button', { name: 'review word again' })).toBeNull()
    );
  });
});

describe('Offline', () => {
  test('a word added offline stays listed, counts as a pending change, and syncs on reconnect', async () => {
    await openPage();
    await waitForReviewData();
    act(() => {
      network.goOffline();
      window.dispatchEvent(new Event('offline'));
    });
    const dialog = await openAddDialog();
    fillWord(dialog, 'kot', 'cat');
    await press(within(dialog).getByRole('button', { name: 'Add Word' }));

    expect(await screen.findByText(/You're offline • 1 changes pending/)).toBeInTheDocument();
    expect(screen.getByText('kot')).toBeInTheDocument();
    expect(serverWords()).toHaveLength(0);
    expect(querySnackbar(SAVE_FAILED)).toBeNull();

    act(() => {
      network.goOnline();
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(serverWords()).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText(/You're offline/)).toBeNull());
    expect(screen.getByText('kot')).toBeInTheDocument();
  });
});

describe('Search, filters, sorting and pages', () => {
  const ANIMALS = ['kot', 'pies', 'koń', 'krowa', 'świnia', 'ąkot'];

  function seedMany(count: number) {
    const words = Array.from({ length: count }, (_, i) =>
      word(`w${i}`, `słowo${String(i).padStart(2, '0')}`, `word ${i}`, {
        createdAt: daysAfterBase(i),
      })
    );
    seedCustom(UID, 'customVocabulary', words);
  }

  test('shows the newest 25 words first and pages through the rest', async () => {
    seedMany(30);
    await openPage();
    await screen.findByText('słowo29');

    const firstPage = columnValues('Polish');
    expect(firstPage).toHaveLength(25);
    expect(firstPage[0]).toBe('słowo29');
    expect(firstPage.at(-1)).toBe('słowo05');
    expect(screen.getByText('1–25 of 30')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(columnValues('Polish')).toEqual(['słowo04', 'słowo03', 'słowo02', 'słowo01', 'słowo00']);
    expect(screen.getByText('26–30 of 30')).toBeInTheDocument();
  });

  test('more rows per page shows them all on one page', async () => {
    seedMany(30);
    await openPage();
    await screen.findByText('słowo29');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Rows per page/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: '50' }));
    expect(columnValues('Polish')).toHaveLength(30);
  });

  test('searching from a later page starts again at the first page of matches', async () => {
    seedMany(30);
    await openPage();
    await screen.findByText('słowo29');
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));

    type(screen.getByPlaceholderText('Search words...'), 'word 1');
    expect(columnValues('Polish')).toEqual([
      'słowo19',
      'słowo18',
      'słowo17',
      'słowo16',
      'słowo15',
      'słowo14',
      'słowo13',
      'słowo12',
      'słowo11',
      'słowo10',
      'słowo01',
    ]);
    expect(screen.getByText('11 of 30 words')).toBeInTheDocument();
  });

  test('search matches Polish, English and notes, ignoring case', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat'),
      word('w2', 'pies', 'dog', { notes: 'Barks' }),
      word('w3', 'krowa', 'cow'),
    ]);
    await openPage();
    await screen.findByText('kot');
    const search = screen.getByPlaceholderText('Search words...');

    type(search, 'KO');
    expect(columnValues('Polish')).toEqual(['kot']);
    type(search, 'cow');
    expect(columnValues('Polish')).toEqual(['krowa']);
    type(search, 'bark');
    expect(columnValues('Polish')).toEqual(['pies']);
    type(search, 'zebra');
    expect(screen.getByText('No words match your filters')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 words')).toBeInTheDocument();
  });

  test('search ignores Polish diacritics, including ł', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'żyrafa', 'giraffe'),
      word('w2', 'łódź', 'boat'),
      word('w3', 'kot', 'cat'),
    ]);
    await openPage();
    await screen.findByText('kot');
    const search = screen.getByPlaceholderText('Search words...');

    type(search, 'zyraf');
    expect(columnValues('Polish')).toEqual(['żyrafa']);
    type(search, 'LODZ');
    expect(columnValues('Polish')).toEqual(['łódź']);
    type(search, 'Żyr');
    expect(columnValues('Polish')).toEqual(['żyrafa']);
  });

  test('filters by part of speech and gender together', async () => {
    seedCustom(UID, 'customVocabulary', [
      word('w1', 'kot', 'cat', { partOfSpeech: 'noun', gender: 'masculine' }),
      word('w2', 'krowa', 'cow', { partOfSpeech: 'noun', gender: 'feminine' }),
      word('w3', 'biegać', 'to run', { partOfSpeech: 'verb' }),
    ]);
    await openPage();
    await screen.findByText('kot');

    await choose('Part of Speech', 'Noun');
    expect(columnValues('Polish').sort()).toEqual(['kot', 'krowa']);
    await choose('Gender', 'Feminine');
    expect(columnValues('Polish')).toEqual(['krowa']);
    expect(screen.getByText('1 of 3 words')).toBeInTheDocument();
    await choose('Part of Speech', 'All');
    await choose('Gender', 'All');
    expect(columnValues('Polish')).toHaveLength(3);
    expect(screen.queryByText(/of 3 words/)).toBeNull();
    expect(selectFor('Gender')).toBeInTheDocument();
  });

  test('sorting by a column orders the rows, and sorting again reverses them', async () => {
    seedCustom(
      UID,
      'customVocabulary',
      ANIMALS.map((polish, i) => word(`w${i}`, polish, `en${i}`, { createdAt: daysAfterBase(i) }))
    );
    await openPage();
    await screen.findByText('kot');

    fireEvent.click(screen.getByRole('button', { name: 'Polish' }));
    // Polish alphabetical order: ą after a, ń after n, ś after s.
    expect(columnValues('Polish')).toEqual(['ąkot', 'koń', 'kot', 'krowa', 'pies', 'świnia']);
    fireEvent.click(screen.getByRole('button', { name: 'Polish' }));
    expect(columnValues('Polish')).toEqual(['świnia', 'pies', 'krowa', 'kot', 'koń', 'ąkot']);
    fireEvent.click(screen.getByRole('button', { name: 'Added' }));
    expect(columnValues('Polish')).toEqual(['kot', 'pies', 'koń', 'krowa', 'świnia', 'ąkot']);
  });
});
