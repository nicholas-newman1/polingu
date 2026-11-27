import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, setupUiTests, LEARNER } from './support/app';
import {
  daysAfterBase,
  declensionCard,
  seedCustom,
  seedReviewedDeclensionCard,
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
const DUPLICATE = 'This declension card is already in your collection.';
const ERROR = 'The declined word must appear in the Back (Answer).';

async function openPage() {
  renderApp('/my-declensions');
  await screen.findByRole('heading', { name: 'My Declensions', level: 5 });
}

const serverCards = () => serverItems(UID, 'customDeclension');

async function openCreateDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Add Card' }));
  return findDialog('Create Custom Card');
}

async function fillCard(
  dialog: HTMLElement,
  card: { front: string; back: string; declined: string; english?: string }
) {
  type(within(dialog).getByRole('textbox', { name: 'Front (Question)' }), card.front);
  type(within(dialog).getByRole('textbox', { name: 'Back (Answer)' }), card.back);
  type(within(dialog).getByRole('textbox', { name: 'Declined Word' }), card.declined);
  if (card.english !== undefined) {
    type(
      within(dialog).getByRole('textbox', { name: 'English Translation (optional)' }),
      card.english
    );
  }
}

async function editRow(question: string) {
  await screen.findByText(question);
  fireEvent.click(within(rowWith(question)).getByRole('button', { name: 'edit card' }));
  return findDialog('Edit Custom Card');
}

/** Answers the "Delete Card" confirmation shown over the edit dialog. */
async function answerDeleteConfirmation(answer: 'Delete' | 'Cancel') {
  const confirmation = await findDialog('Delete Card');
  expect(confirmation).toHaveTextContent('Are you sure you want to delete this card?');
  fireEvent.click(within(confirmation).getByRole('button', { name: answer }));
}

const KOTA = { front: 'Nie mam ___.', back: 'Nie mam kota.', declined: 'kota' };

describe('My Declensions', () => {
  test('shows an empty state until a card is added', async () => {
    await openPage();
    expect(screen.getByText('No custom declension cards yet')).toBeInTheDocument();
  });

  test('creating a card lists it and saves it; the English translation may be left out', async () => {
    await openPage();
    const dialog = await openCreateDialog();
    await fillCard(dialog, { ...KOTA, front: ' Nie mam ___. ' });
    await choose('Case', 'Genitive', dialog);
    await choose('Gender', 'Masculine', dialog);
    await choose('Number', 'Singular', dialog);
    type(within(dialog).getByRole('textbox', { name: 'Hint (optional)' }), ' nie + genitive ');
    await press(within(dialog).getByRole('button', { name: 'Create Card' }));

    await waitForDialogsToClose();
    const row = rowWith('Nie mam ___.');
    expect(within(row).getByText('kota')).toBeInTheDocument();
    expect(within(row).getByText('Genitive')).toBeInTheDocument();
    expect(within(row).getByText('Masculine')).toBeInTheDocument();
    await waitFor(() =>
      expect(Object.values(serverCards())).toEqual([
        expect.objectContaining({
          front: 'Nie mam ___.',
          back: 'Nie mam kota.',
          declined: 'kota',
          case: 'Genitive',
          gender: 'Masculine',
          number: 'Singular',
          hint: 'nie + genitive',
        }),
      ])
    );
    expect(Object.values(serverCards())[0]).not.toHaveProperty('english');
  });

  test('a new card starts with no case or gender and cannot be created until both are chosen', async () => {
    await openPage();
    const dialog = await openCreateDialog();
    expect(selectFor('Case', dialog)).not.toHaveTextContent(/[a-z]/i);
    expect(selectFor('Gender', dialog)).not.toHaveTextContent(/[a-z]/i);
    await fillCard(dialog, KOTA);
    const create = within(dialog).getByRole('button', { name: 'Create Card' });
    await settle();
    expect(create).toBeDisabled();

    await choose('Case', 'Genitive', dialog);
    await settle();
    expect(create).toBeDisabled();
    await choose('Gender', 'Masculine', dialog);
    await waitFor(() => expect(create).toBeEnabled());
  });

  test('editing a card keeps its saved case and gender', async () => {
    seedCustom(UID, 'customDeclension', [
      declensionCard('d1', KOTA.front, 'kota', { case: 'Accusative', gender: 'Feminine' }),
    ]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    expect(selectFor('Case', dialog)).toHaveTextContent('Accusative');
    expect(selectFor('Gender', dialog)).toHaveTextContent('Feminine');
  });

  test('the declined word must appear as a whole word in the answer', async () => {
    await openPage();
    const dialog = await openCreateDialog();
    await fillCard(dialog, { ...KOTA, declined: 'kot' });
    await choose('Case', 'Genitive', dialog);
    await choose('Gender', 'Masculine', dialog);
    const create = within(dialog).getByRole('button', { name: 'Create Card' });
    const declined = within(dialog).getByRole('textbox', { name: 'Declined Word' });

    // "kot" is only part of "kota".
    expect(within(dialog).getByText(ERROR)).toBeInTheDocument();
    expect(declined).toHaveAttribute('aria-invalid', 'true');
    expect(create).toBeDisabled();

    // Case and the full stop after it are ignored.
    type(declined, 'KOTA');
    expect(within(dialog).queryByText(ERROR)).toBeNull();
    await waitFor(() => expect(create).toBeEnabled());

    // Changing the answer checks again.
    type(within(dialog).getByRole('textbox', { name: 'Back (Answer)' }), 'Nie mam psa.');
    expect(within(dialog).getByText(ERROR)).toBeInTheDocument();
    expect(create).toBeDisabled();
    expect(serverCards()).toEqual({});
  });

  test('a card with the same question, answer, case, gender and number is refused', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    await openPage();
    await screen.findByText(KOTA.front);
    const dialog = await openCreateDialog();
    await fillCard(dialog, { ...KOTA, front: 'nie  MAM ___.', declined: 'Kota ' });
    await choose('Case', 'Genitive', dialog);
    await choose('Gender', 'Masculine', dialog);
    await press(within(dialog).getByRole('button', { name: 'Create Card' }));

    const snackbar = await findSnackbar(DUPLICATE);
    expect(
      within(snackbar).queryByRole('button', { name: 'Review again', hidden: true })
    ).toBeNull();
    const stillOpen = await expectDialogToStayOpen('Create Custom Card');
    expect(within(stillOpen).getByRole('textbox', { name: 'Declined Word' })).toHaveValue('Kota ');
    expect(Object.keys(serverCards())).toEqual(['d1']);
  });

  test('the same word in a different case is a new card, not a duplicate', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    await openPage();
    await screen.findByText(KOTA.front);
    const dialog = await openCreateDialog();
    await fillCard(dialog, KOTA);
    await choose('Case', 'Accusative', dialog);
    await choose('Gender', 'Masculine', dialog);
    await press(within(dialog).getByRole('button', { name: 'Create Card' }));

    await waitFor(() => expect(Object.keys(serverCards())).toHaveLength(2));
    expect(querySnackbar(DUPLICATE)).toBeNull();
  });

  test('the duplicate warning can requeue a studied card for review', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    seedReviewedDeclensionCard(UID, 'd1');
    await openPage();
    await screen.findByText(KOTA.front);
    await within(rowWith(KOTA.front)).findByRole('button', { name: 'review card again' });
    const dialog = await openCreateDialog();
    await fillCard(dialog, KOTA);
    await choose('Case', 'Genitive', dialog);
    await choose('Gender', 'Masculine', dialog);
    await press(within(dialog).getByRole('button', { name: 'Create Card' }));

    const snackbar = await findSnackbar(DUPLICATE);
    fireEvent.click(within(snackbar).getByRole('button', { name: 'Review again', hidden: true }));
    await waitFor(() =>
      expect(remote.get(userPath(UID, 'declensionReviewCards', 'd1'))).toMatchObject({
        fsrsCard: { state: 0 },
      })
    );
  });

  test('"review card again" in the table requeues a studied card', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    seedReviewedDeclensionCard(UID, 'd1');
    await openPage();
    await screen.findByText(KOTA.front);
    fireEvent.click(
      await within(rowWith(KOTA.front)).findByRole('button', { name: 'review card again' })
    );

    expect(await findSnackbar('Card queued for review again.')).toBeInTheDocument();
    await waitFor(() =>
      expect(remote.get(userPath(UID, 'declensionReviewCards', 'd1'))).toMatchObject({
        fsrsCard: { state: 0 },
      })
    );
  });

  test('editing a card updates it and can clear its English translation', async () => {
    seedCustom(UID, 'customDeclension', [
      declensionCard('d1', KOTA.front, 'kota', { english: "I don't have a cat." }),
    ]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    expect(within(dialog).getByRole('textbox', { name: 'Declined Word' })).toHaveValue('kota');
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Clear English Translation (optional)' })
    );
    await choose('Number', 'Plural', dialog);
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitForDialogsToClose();
    expect(within(rowWith(KOTA.front)).getByText('Plural')).toBeInTheDocument();
    await waitFor(() => expect(serverCards().d1).toMatchObject({ number: 'Plural' }));
    expect(serverCards().d1).not.toHaveProperty('english');
  });

  test('clearing the hint while editing removes it', async () => {
    seedCustom(UID, 'customDeclension', [
      declensionCard('d1', KOTA.front, 'kota', { hint: 'nie + genitive' }),
    ]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    expect(within(dialog).getByRole('textbox', { name: 'Hint (optional)' })).toHaveValue(
      'nie + genitive'
    );
    type(within(dialog).getByRole('textbox', { name: 'Hint (optional)' }), '');
    type(within(dialog).getByRole('textbox', { name: 'Back (Answer)' }), 'Nie mam kotka.');
    type(within(dialog).getByRole('textbox', { name: 'Declined Word' }), 'kotka');
    await press(within(dialog).getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(serverCards().d1).toMatchObject({ declined: 'kotka' }));
    expect(serverCards().d1).not.toHaveProperty('hint');
  });

  test('a card can be deleted from its edit dialog after confirming', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await answerDeleteConfirmation('Delete');
    await waitForDialogsToClose();
    await waitFor(() => expect(screen.queryByText(KOTA.front)).toBeNull());
    await waitFor(() => expect(serverCards()).toEqual({}));
  });

  test('deleting a card from its edit dialog asks for confirmation once', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await answerDeleteConfirmation('Delete');

    await waitFor(() => expect(serverCards()).toEqual({}));
    await waitForDialogsToClose();
    expect(screen.queryByRole('dialog', { name: 'Delete Card' })).toBeNull();
  });

  test('declining the confirmation in the edit dialog keeps the card', async () => {
    seedCustom(UID, 'customDeclension', [declensionCard('d1', KOTA.front, 'kota')]);
    await openPage();
    const dialog = await editRow(KOTA.front);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await answerDeleteConfirmation('Cancel');

    const stillOpen = await expectDialogToStayOpen('Edit Custom Card');
    expect(within(stillOpen).getByRole('textbox', { name: 'Declined Word' })).toHaveValue('kota');
    expect(rowWith(KOTA.front)).toBeInTheDocument();
    expect(Object.keys(serverCards())).toEqual(['d1']);
  });

  test('filters by case, gender and number, searches hints, and sorts by answer', async () => {
    seedCustom(UID, 'customDeclension', [
      declensionCard('d1', 'Nie mam ___.', 'kota', { hint: 'negation' }),
      declensionCard('d2', 'Widzę ___.', 'psa', {
        case: 'Accusative',
        createdAt: daysAfterBase(1),
      }),
      declensionCard('d3', 'Nie ma ___.', 'kobiet', {
        gender: 'Feminine',
        number: 'Plural',
        createdAt: daysAfterBase(2),
      }),
    ]);
    await openPage();
    await screen.findByText('Widzę ___.');

    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(columnValues('Answer')).toEqual(['kobiet', 'kota', 'psa']);

    await choose('Case', 'Genitive');
    expect(columnValues('Answer')).toEqual(['kobiet', 'kota']);
    await choose('Number', 'Plural');
    expect(columnValues('Answer')).toEqual(['kobiet']);
    await choose('Gender', 'Masculine');
    expect(screen.getByText('No cards match your filters')).toBeInTheDocument();
    await choose('Gender', 'All');
    await choose('Number', 'All');
    await choose('Case', 'All');

    type(screen.getByPlaceholderText('Search cards...'), 'NEGATION');
    expect(columnValues('Answer')).toEqual(['kota']);
    expect(screen.getByText('1 of 3 cards')).toBeInTheDocument();
  });
});
