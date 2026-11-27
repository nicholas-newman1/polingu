import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, setupUiTests, waitForReviewData, LEARNER } from './support/app';
import {
  daysAfterBase,
  seedCustom,
  seedReviewedSentence,
  sentence,
  serverItems,
  userPath,
} from './support/data';
import { remote } from './support/firestore';
import {
  choose,
  columnValues,
  expectDialogToStayOpen,
  findDialog,
  findSnackbar,
  press,
  rowWith,
  selectFor,
  type,
  waitForDialogsToClose,
  waitForMenuToClose,
} from './support/ui';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));

setupUiTests();

const UID = LEARNER.uid;
const DUPLICATE = 'This sentence is already in your collection.';

async function openPage() {
  const app = renderApp('/my-sentences');
  await screen.findByRole('heading', { name: 'My Sentences', level: 5 });
  return app;
}

const serverSentences = () => serverItems(UID, 'customSentences');

async function openAddDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Sentence' }));
  return findDialog('Add Sentence');
}

function fillSentence(dialog: HTMLElement, polish: string, english: string) {
  type(within(dialog).getByRole('textbox', { name: 'Polish' }), polish);
  type(within(dialog).getByRole('textbox', { name: 'English' }), english);
}

async function editRow(polish: string) {
  await screen.findByText(polish);
  fireEvent.click(within(rowWith(polish)).getByRole('button', { name: 'edit sentence' }));
  return findDialog('Edit Sentence');
}

describe('My Sentences', () => {
  test('shows an empty state until a sentence is added', async () => {
    await openPage();
    expect(screen.getByText('No custom sentences yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Your First Sentence' }));
    expect(await findDialog('Add Sentence')).toBeInTheDocument();
  });

  test('adding a sentence with a level and tags lists it and saves it', async () => {
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: ['past tense'], style: [] });
    await openPage();
    await waitForReviewData();
    const dialog = await openAddDialog();
    fillSentence(dialog, ' Jem obiad. ', ' I am eating lunch. ');
    await choose('Level', 'B1', dialog);
    fireEvent.mouseDown(selectFor('Tags', dialog));
    const tags = screen.getByRole('listbox');
    expect(
      within(tags)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['food', 'past tense']);
    fireEvent.click(within(tags).getByRole('option', { name: 'food' }));
    fireEvent.keyDown(tags, { key: 'Escape' });
    await waitForMenuToClose();
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    await waitForDialogsToClose();
    const row = rowWith('Jem obiad.');
    expect(within(row).getByText('I am eating lunch.')).toBeInTheDocument();
    expect(within(row).getByText('B1')).toBeInTheDocument();
    await waitFor(() =>
      expect(Object.values(serverSentences())).toEqual([
        expect.objectContaining({
          polish: 'Jem obiad.',
          english: 'I am eating lunch.',
          level: 'B1',
          tags: ['food'],
        }),
      ])
    );
  });

  test('a sentence already in the collection is refused, ignoring case and spacing', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    await openPage();
    await screen.findByText('Mam kota.');
    const dialog = await openAddDialog();
    fillSentence(dialog, 'mam   KOTA.', 'I own a cat.');
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    const snackbar = await findSnackbar(DUPLICATE);
    expect(
      within(snackbar).queryByRole('button', { name: 'Review again', hidden: true })
    ).toBeNull();
    const stillOpen = await expectDialogToStayOpen('Add Sentence');
    expect(within(stillOpen).getByRole('textbox', { name: 'English' })).toHaveValue('I own a cat.');
    expect(Object.keys(serverSentences())).toEqual(['s1']);
  });

  test('the duplicate warning can requeue a studied sentence for review', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    seedReviewedSentence(UID, 's1', 'pl-to-en');
    await openPage();
    await screen.findByText('Mam kota.');
    await within(rowWith('Mam kota.')).findByRole('button', { name: 'review sentence again' });
    const dialog = await openAddDialog();
    fillSentence(dialog, 'Mam kota.', 'I have a cat.');
    await press(within(dialog).getByRole('button', { name: 'Add Sentence' }));

    const snackbar = await findSnackbar(DUPLICATE);
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Review again', hidden: true }));
    await waitFor(() =>
      expect(remote.get(userPath(UID, 'sentenceReviewCards-pl-en', 's1'))).toMatchObject({
        fsrsCard: { state: 0 },
      })
    );
  });

  test('"review sentence again" requeues a studied sentence from the table', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    seedReviewedSentence(UID, 's1', 'en-to-pl');
    await openPage();
    await screen.findByText('Mam kota.');
    fireEvent.click(
      await within(rowWith('Mam kota.')).findByRole('button', { name: 'review sentence again' })
    );

    expect(await findSnackbar('Sentence queued for review again.')).toBeInTheDocument();
    await waitFor(() =>
      expect(remote.get(userPath(UID, 'sentenceReviewCards-en-pl', 's1'))).toMatchObject({
        fsrsCard: { state: 0 },
      })
    );
  });

  test('editing a sentence changes its text and level', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    await openPage();
    const dialog = await editRow('Mam kota.');
    expect(within(dialog).getByRole('textbox', { name: 'English' })).toHaveValue('I have a cat.');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Mam dwa koty.');
    type(within(dialog).getByRole('textbox', { name: 'English' }), 'I have two cats.');
    await choose('Level', 'A2', dialog);
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitForDialogsToClose();
    expect(within(rowWith('Mam dwa koty.')).getByText('A2')).toBeInTheDocument();
    await waitFor(() =>
      expect(serverSentences().s1).toMatchObject({
        polish: 'Mam dwa koty.',
        english: 'I have two cats.',
        level: 'A2',
      })
    );
  });

  test('editing a sentence into a copy of another one is refused', async () => {
    seedCustom(UID, 'customSentences', [
      sentence('s1', 'Mam kota.', 'I have a cat.'),
      sentence('s2', 'Mam psa.', 'I have a dog.', { createdAt: daysAfterBase(1) }),
    ]);
    await openPage();
    const dialog = await editRow('Mam psa.');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Mam kota.');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar(DUPLICATE)).toBeInTheDocument();
    const stillOpen = await expectDialogToStayOpen('Edit Sentence');
    expect(within(stillOpen).getByRole('textbox', { name: 'Polish' })).toHaveValue('Mam kota.');
    expect(serverSentences().s2).toMatchObject({ polish: 'Mam psa.' });
    expect(within(rowWith('Mam psa.')).getByText('I have a dog.')).toBeInTheDocument();
  });

  test('deleting a sentence removes it once confirmed', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    await openPage();
    await screen.findByText('Mam kota.');
    fireEvent.click(within(rowWith('Mam kota.')).getByRole('button', { name: 'delete sentence' }));

    const confirmation = await findDialog('Delete Sentence');
    expect(confirmation).toHaveTextContent('Are you sure you want to delete this sentence?');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Mam kota.')).toBeNull());
    await waitFor(() => expect(serverSentences()).toEqual({}));
  });

  test('an edit the server rejects is rolled back with an error', async () => {
    seedCustom(UID, 'customSentences', [sentence('s1', 'Mam kota.', 'I have a cat.')]);
    await openPage();
    remote.fail({ op: 'updateDoc', path: /customSentences/ });
    const dialog = await editRow('Mam kota.');
    type(within(dialog).getByRole('textbox', { name: 'Polish' }), 'Mam dwa koty.');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    expect(await findSnackbar('Failed to save. Please try again.')).toBeInTheDocument();
    expect(await screen.findByText('Mam kota.')).toBeInTheDocument();
    expect(screen.queryByText('Mam dwa koty.')).toBeNull();
    expect(serverSentences().s1).toMatchObject({ polish: 'Mam kota.' });
  });

  test('filters by level and search, and sorts by level', async () => {
    seedCustom(UID, 'customSentences', [
      sentence('s1', 'Mam kota.', 'I have a cat.', { level: 'A2' }),
      sentence('s2', 'Kot śpi.', 'The cat sleeps.', { level: 'A1', createdAt: daysAfterBase(1) }),
      sentence('s3', 'Pies szczeka.', 'The dog barks.', {
        level: 'B1',
        createdAt: daysAfterBase(2),
      }),
    ]);
    await openPage();
    await screen.findByText('Mam kota.');

    fireEvent.click(screen.getByRole('button', { name: 'Level' }));
    expect(columnValues('Level')).toEqual(['A1', 'A2', 'B1']);

    type(screen.getByPlaceholderText('Search sentences...'), 'cat');
    expect(columnValues('Polish')).toEqual(['Kot śpi.', 'Mam kota.']);
    expect(screen.getByText('2 of 3 sentences')).toBeInTheDocument();

    await choose('Level', 'A2');
    expect(columnValues('Polish')).toEqual(['Mam kota.']);
    await choose('Level', 'B1');
    expect(screen.getByText('No sentences match your filters')).toBeInTheDocument();
  });
});
