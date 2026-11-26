import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { callables, renderApp, setupUiTests, uploads, LEARNER } from './support/app';
import { book, daysAfterBase, seedBooks, seedReadingProgress, userPath } from './support/data';
import { remote } from './support/firestore';
import { userDb } from '../../../src/lib/offlineDb/userDb';
import {
  expectDialogToStayOpen,
  findDialog,
  findSnackbar,
  press,
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
const MB = 1024 * 1024;

function storageUsage(usedBytes = 1.5 * MB, maxBytes = 100 * MB) {
  callables.set('getStorageUsage', () => ({ usedBytes, maxBytes }));
}

async function openLibrary() {
  const app = renderApp('/library');
  await screen.findByText('My Library');
  return app;
}

/** The card of a ready book, found by its title. */
function bookCard(title: string) {
  return screen.getByText(title).closest('.MuiCard-root') as HTMLElement;
}

async function openBookMenu(title: string) {
  const more = within(bookCard(title)).getByTestId('MoreVertIcon').closest('button')!;
  fireEvent.click(more);
  return screen.findByRole('menu');
}

async function openAddBook() {
  fireEvent.click(screen.getByText('Add Book'));
  return findDialog('Add Book');
}

/**
 * Waits for the app to tell the reader that something went wrong, however it chooses to:
 * an alert (snackbar) or a message saying it failed.
 */
async function expectFailureReported() {
  await waitFor(
    () => {
      const alerts = screen.queryAllByRole('alert', { hidden: true });
      const messages = screen.queryAllByText(/fail|could ?n[o'’]t|error|try again/i);
      expect(alerts.length + messages.length).toBeGreaterThan(0);
    },
    // The failure is already back from the (fake) server; a report would follow at once.
    { timeout: 1500 }
  );
}

async function openDeleteDialog(title: string) {
  const menu = await openBookMenu(title);
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Delete' }));
  await waitForMenuToClose();
  return findDialog('Delete Book');
}

async function openEditDialog(title: string) {
  const menu = await openBookMenu(title);
  fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }));
  await waitForMenuToClose();
  return findDialog('Edit Book');
}

/** Marks the uploaded book as processed, as the Cloud Function does. */
function finishProcessing(id: string, extra: Parameters<typeof book>[1] = {}) {
  act(() => remote.seed(userPath(UID, 'books', id), book(id, { status: 'ready', ...extra })));
}

describe('Library', () => {
  test('an empty library invites adding a book and shows the storage used', async () => {
    storageUsage();
    await openLibrary();
    expect(screen.getByText('Your library is empty')).toBeInTheDocument();
    expect(await screen.findByText('1.5 MB / 100.0 MB')).toBeInTheDocument();
  });

  test('lists ready books with their reading progress, most recently read first', async () => {
    await seedBooks(UID, [
      book('b1', {
        title: 'Pan Tadeusz',
        author: 'Adam Mickiewicz',
        fileType: 'pdf',
        pageCount: 200,
      }),
      book('b2', { title: 'Lalka', wordCount: 12345 }),
      book('b3', { title: 'Quo Vadis' }),
    ]);
    seedReadingProgress(UID, {
      bookId: 'b1',
      currentPage: 50,
      scrollPercent: 0.25,
      lastReadAt: daysAfterBase(1),
    });
    seedReadingProgress(UID, {
      bookId: 'b2',
      currentPage: 1,
      scrollPercent: 0.4,
      lastReadAt: daysAfterBase(2),
    });
    await openLibrary();
    await screen.findByText('Pan Tadeusz');

    await waitFor(() => {
      const titles = screen.getAllByText(/Pan Tadeusz|Lalka|Quo Vadis/).map((el) => el.textContent);
      expect(titles).toEqual(['Lalka', 'Pan Tadeusz', 'Quo Vadis']);
    });
    expect(within(bookCard('Pan Tadeusz')).getByText('25%')).toBeInTheDocument();
    expect(within(bookCard('Pan Tadeusz')).getByText('Adam Mickiewicz')).toBeInTheDocument();
    expect(within(bookCard('Lalka')).getByText('40%')).toBeInTheDocument();
    expect(within(bookCard('Lalka')).getByText('12,345 words')).toBeInTheDocument();
    expect(within(bookCard('Quo Vadis')).getByText('0%')).toBeInTheDocument();
  });

  test('books still being processed are shown by file name', async () => {
    await seedBooks(UID, [
      book('b1', { status: 'processing', fileName: 'chapter1.pdf', title: '' }),
    ]);
    await openLibrary();
    expect(await screen.findByText('Processing...')).toBeInTheDocument();
    expect(screen.getByText('chapter1.pdf')).toBeInTheDocument();
  });

  test('choosing a book opens it in the reader', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    const app = await openLibrary();
    fireEvent.click(await screen.findByText('Lalka'));
    await waitFor(() => expect(app.location()).toBe('/reader/b1'));
  });
});

describe('Adding a book by pasting text', () => {
  test('shows upload then processing progress, and closes once the book is ready', async () => {
    storageUsage(1 * MB);
    await openLibrary();
    const dialog = await openAddBook();
    expect(within(dialog).getByRole('button', { name: 'Add Text' })).toBeDisabled();
    type(within(dialog).getByRole('textbox', { name: 'Title' }), ' Bajki ');
    type(within(dialog).getByRole('textbox', { name: 'Author' }), 'Ignacy Krasicki');
    type(within(dialog).getByRole('textbox', { name: 'Text' }), '  Szczur i kot.  ');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Text' }));

    expect(await within(dialog).findByRole('button', { name: 'Adding...' })).toBeDisabled();
    await waitFor(() => expect(uploads.tasks).toHaveLength(1));
    const upload = uploads.latest();
    expect(upload.path).toBe(`books/users/${UID}/pending/${upload.id}/book.txt`);
    expect(upload.metadata?.customMetadata).toEqual({
      booktitle: 'Bajki',
      bookauthor: 'Ignacy Krasicki',
    });
    expect(await upload.file.text()).toBe('Szczur i kot.');

    act(() => upload.progress(0.4));
    expect(await screen.findByText('Uploading...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { hidden: true, name: '' })).toHaveAttribute(
      'aria-valuenow',
      '40'
    );

    storageUsage(2 * MB);
    act(() => upload.complete());
    expect(await screen.findByText('Processing book...')).toBeInTheDocument();

    finishProcessing(upload.id, { title: 'Bajki' });
    await waitForDialogsToClose();
    expect(screen.queryByText('Processing book...')).toBeNull();
    expect(await screen.findByText('Bajki')).toBeInTheDocument();
    expect(await screen.findByText('2.0 MB / 100.0 MB')).toBeInTheDocument();
  });

  test('a failed upload is reported and the text is kept for another try', async () => {
    await openLibrary();
    const dialog = await openAddBook();
    type(within(dialog).getByRole('textbox', { name: 'Text' }), 'Szczur i kot.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Text' }));
    await waitFor(() => expect(uploads.tasks).toHaveLength(1));

    act(() => uploads.latest().fail(new Error('Storage quota exceeded')));

    const snackbar = await findSnackbar('Storage quota exceeded');
    expect(snackbar).toBeInTheDocument();
    expect(screen.queryByText('Uploading...')).toBeNull();
    expect(within(dialog).getByRole('textbox', { name: 'Text' })).toHaveValue('Szczur i kot.');
    await press(within(dialog).getByRole('button', { name: 'Add Text' }));
  });

  test('a book the server cannot process is reported with the server’s reason', async () => {
    await openLibrary();
    const dialog = await openAddBook();
    type(within(dialog).getByRole('textbox', { name: 'Text' }), 'Szczur i kot.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Text' }));
    await waitFor(() => expect(uploads.tasks).toHaveLength(1));
    const upload = uploads.latest();
    act(() => upload.complete());
    await screen.findByText('Processing book...');

    act(() =>
      remote.seed(
        userPath(UID, 'books', upload.id),
        book(upload.id, { status: 'error', error: 'Text is not Polish' })
      )
    );
    expect(await findSnackbar('Text is not Polish')).toBeInTheDocument();
    expect(screen.queryByText('Processing book...')).toBeNull();
  });

  test('cancelling clears what was typed', async () => {
    await openLibrary();
    let dialog = await openAddBook();
    type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Bajki');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitForDialogsToClose();

    dialog = await openAddBook();
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });
});

describe('Uploading a PDF', () => {
  const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

  test('closes the dialog at once and uploads the file with the typed title', async () => {
    await openLibrary();
    const dialog = await openAddBook();
    type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Ferdydurke');
    const pdf = new File(['%PDF-1.4'], 'ferdydurke.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput(), { target: { files: [pdf] } });

    await waitForDialogsToClose();
    await waitFor(() => expect(uploads.tasks).toHaveLength(1));
    const upload = uploads.latest();
    expect(upload.path).toMatch(/\/ferdydurke\.pdf$/);
    expect(upload.metadata?.customMetadata).toEqual({ booktitle: 'Ferdydurke' });

    act(() => upload.progress(1));
    expect(await screen.findByText('Uploading...')).toBeInTheDocument();
    act(() => upload.complete());
    finishProcessing(upload.id, { title: 'Ferdydurke', fileType: 'pdf' });
    await waitFor(() => expect(screen.queryByText(/Uploading|Processing book/)).toBeNull());
  });

  test('anything but a PDF is refused', async () => {
    await openLibrary();
    await openAddBook();
    const doc = new File(['hello'], 'notes.docx', { type: 'application/msword' });
    fireEvent.change(fileInput(), { target: { files: [doc] } });

    expect(await findSnackbar('Only PDF files are supported.')).toBeInTheDocument();
    expect(uploads.tasks).toHaveLength(0);
  });

  test('a file over 50 MB is refused', async () => {
    await openLibrary();
    await openAddBook();
    const big = new File(['%PDF'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 51 * MB });
    fireEvent.change(fileInput(), { target: { files: [big] } });

    expect(await findSnackbar('File too large. Maximum size is 50MB.')).toBeInTheDocument();
    expect(uploads.tasks).toHaveLength(0);
  });
});

describe('Editing and deleting a book', () => {
  test('renaming a book and clearing its author saves both', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka', author: 'B. Prus' })]);
    await openLibrary();
    await screen.findByText('Lalka');
    const dialog = await openEditDialog('Lalka');
    expect(within(dialog).getByRole('textbox', { name: 'Author' })).toHaveValue('B. Prus');

    type(within(dialog).getByRole('textbox', { name: 'Title' }), '  ');
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    type(within(dialog).getByRole('textbox', { name: 'Title' }), ' Lalka, tom 1 ');
    type(within(dialog).getByRole('textbox', { name: 'Author' }), '');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitForDialogsToClose();
    expect(await screen.findByText('Lalka, tom 1')).toBeInTheDocument();
    const saved = remote.get(userPath(UID, 'books', 'b1'));
    expect(saved).toMatchObject({ title: 'Lalka, tom 1', color: 'red' });
    expect(saved).not.toHaveProperty('author');
  });

  test('deleting a book asks first, then removes it and its saved text', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    await userDb.userData.put({
      key: '__book-text-b1',
      data: 'Rozdział 1',
      lastModified: 1,
      pendingSync: 0,
    });
    storageUsage(3 * MB);
    callables.set<{ bookId: string }>('deleteBook', ({ bookId }) => {
      remote.remove(userPath(UID, 'books', bookId));
      storageUsage(1 * MB);
      return { success: true };
    });
    await openLibrary();
    await screen.findByText('3.0 MB / 100.0 MB');
    const dialog = await openDeleteDialog('Lalka');
    expect(within(dialog).getByText(/delete "Lalka"\?/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitForDialogsToClose();
    expect(callables.callsTo('deleteBook')).toEqual([{ bookId: 'b1' }]);
    expect(await screen.findByText('Your library is empty')).toBeInTheDocument();
    expect(await screen.findByText('1.0 MB / 100.0 MB')).toBeInTheDocument();
    expect(await userDb.userData.get('__book-text-b1')).toBeUndefined();
  });

  test('a delete that fails leaves the dialog open so it can be retried', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    callables.set('deleteBook', () => {
      throw new Error('internal');
    });
    await openLibrary();
    await screen.findByText('Lalka');
    const dialog = await openDeleteDialog('Lalka');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(callables.callsTo('deleteBook')).toHaveLength(1));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeEnabled()
    );
    const stillOpen = await expectDialogToStayOpen('Delete Book');
    expect(within(stillOpen).getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByText('Lalka')).toBeInTheDocument();
  });

  test('a delete that fails says so', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    callables.set('deleteBook', () => {
      throw new Error('internal');
    });
    await openLibrary();
    await screen.findByText('Lalka');
    const dialog = await openDeleteDialog('Lalka');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(callables.callsTo('deleteBook')).toHaveLength(1));
    await expectFailureReported();
  });

  test('an edit the server refuses says so', async () => {
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    await openLibrary();
    await screen.findByText('Lalka');
    remote.fail({ op: 'updateDoc', path: /\/books\// });
    const dialog = await openEditDialog('Lalka');
    type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Lalka, tom 1');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(remote.callsTo('updateDoc')).toHaveLength(1));
    await expectFailureReported();
  });
});
