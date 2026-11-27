import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, setupUiTests, uploads, LEARNER } from './support/app';
import { book, seedBooks, seedReadingProgress, userPath } from './support/data';
import { remote } from './support/firestore';
import { intersect } from './support/browser';
import { pdfFile } from './support/pdfjs';
import { network } from '../../sync/support/harness';
import type { ReadingProgress } from '../../../src/types/reader';

vi.mock('firebase/firestore', () => import('./support/firestore'));
vi.mock('firebase/functions', () => import('./support/functions'));
vi.mock('firebase/storage', () => import('./support/storage'));
vi.mock('firebase/auth', () => import('./support/auth'));
vi.mock('pdfjs-dist', () => import('./support/pdfjs'));

setupUiTests();

const UID = LEARNER.uid;
const LOAD_FAILED = "Couldn't load this book. Check your connection and try again.";
const progressPath = (bookId: string) => userPath(UID, 'data', `reader-progress-${bookId}`);
const savedProgress = (bookId = 'b1') =>
  remote.get(progressPath(bookId)) as ReadingProgress | undefined;

/** The reader's controls are icon buttons labelled by their tooltips. */
function control(label: string) {
  const labelled = screen.getByLabelText(label);
  return (
    labelled.tagName === 'BUTTON' ? labelled : labelled.querySelector('button')
  ) as HTMLElement;
}

async function leaveReader(title: string) {
  const header = screen.getByRole('heading', { name: title, level: 6 }).parentElement!;
  fireEvent.click(within(header).getAllByRole('button')[0]);
  await screen.findByText('My Library');
}

describe('Reading a text book', () => {
  const TEXT = [
    'Rozdział pierwszy.',
    'Pani Izabela weszła do sklepu.',
    'Wokulski milczał długo.',
    'Koniec rozdziału.',
  ].join('\n\n');

  let downloads: string[];

  beforeEach(async () => {
    downloads = [];
    vi.stubGlobal('fetch', async (url: string) => {
      downloads.push(url);
      return { ok: true, text: async () => TEXT };
    });
    await seedBooks(UID, [book('b1', { title: 'Lalka' })]);
    // Paragraphs sit 500px apart, so scrolling to one can be checked.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element
    ) {
      const index = Number(this.getAttribute('data-paragraph-index') ?? 0);
      return {
        top: index * 500,
        bottom: index * 500 + 100,
        left: 0,
        right: 600,
        width: 600,
        height: 100,
        x: 0,
        y: index * 500,
        toJSON: () => ({}),
      };
    });
  });

  async function openBook() {
    renderApp('/reader/b1');
    return screen.findByText('Izabela');
  }

  const paragraph = (word: string) => screen.getByText(word).closest('p') as HTMLElement;

  test('shows the text paragraph by paragraph, titled with the book’s name', async () => {
    await openBook();
    expect(screen.getByRole('heading', { name: 'Lalka', level: 6 })).toBeInTheDocument();
    expect(screen.getAllByText(/./, { selector: 'p > span' }).length).toBeGreaterThan(0);
    for (const word of ['Rozdział', 'Wokulski', 'Koniec']) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
    expect(paragraph('Rozdział')).not.toBe(paragraph('Wokulski'));
    expect(downloads).toEqual([`https://storage.test/books/users/${UID}/b1/b1.txt`]);
  });

  test('a first visit saves a starting position', async () => {
    await openBook();
    await waitFor(() => expect(savedProgress()).toMatchObject({ bookId: 'b1', scrollPercent: 0 }));
  });

  test('returns to the saved paragraph and lists the saved bookmarks', async () => {
    seedReadingProgress(UID, {
      bookId: 'b1',
      currentPage: 1,
      scrollPercent: 0.42,
      lastReadAt: 1,
      textAnchorIndex: 2,
      textBookmarks: [1, 3],
    });
    await openBook();
    // Paragraph 3 sits at 1000px; the header covers the top 72px. (The percentage shown is
    // worked out from the real scroll position on the next frame, so it is not checked here.)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 928 });

    fireEvent.click(control('Bookmarks'));
    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Pani Izabela weszła do sklepu.Paragraph 2',
      'Koniec rozdziału.Paragraph 4',
    ]);

    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(items[1]);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1428 });
  });

  test('with no bookmarks the bookmarks list cannot be opened', async () => {
    await openBook();
    expect(control('Bookmarks')).toBeDisabled();
  });

  test('bookmarking the paragraph being read saves it at once, and again removes it', async () => {
    await openBook();
    act(() => intersect([paragraph('Wokulski')], true));

    fireEvent.click(control('Add bookmark'));
    await waitFor(() => expect(savedProgress()?.textBookmarks).toEqual([2]));
    expect(control('Remove bookmark')).toBeInTheDocument();
    expect(control('Bookmarks')).toBeEnabled();

    fireEvent.click(control('Remove bookmark'));
    await waitFor(() => expect(savedProgress()?.textBookmarks).toEqual([]));
    expect(control('Add bookmark')).toBeInTheDocument();
  });

  test('the paragraph being read is saved when leaving the book', async () => {
    await openBook();
    act(() => intersect([paragraph('Koniec')], true));
    await leaveReader('Lalka');
    await waitFor(() => expect(savedProgress()).toMatchObject({ textAnchorIndex: 3 }));
  });

  test('scrolling shows how far through the book the reader is, and that is saved', async () => {
    await openBook();
    expect(screen.getByText('0%')).toBeInTheDocument();
    // 2000px of text in a 768px-tall window, scrolled 616px down: half way.
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 616 });
    try {
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(await screen.findByText('50%')).toBeInTheDocument();
      await leaveReader('Lalka');
      await waitFor(() => expect(savedProgress()).toMatchObject({ scrollPercent: 0.5 }));
    } finally {
      delete (document.documentElement as { scrollHeight?: number }).scrollHeight;
      if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
      else delete (window as { scrollY?: number }).scrollY;
    }
  });

  test('the text size steps between three sizes and is remembered', async () => {
    await openBook();
    expect(control('Larger text')).toBeDisabled();
    fireEvent.click(control('Smaller text'));
    expect(localStorage.getItem('polingu_transcriptFontSize')).toBe('medium');
    fireEvent.click(control('Smaller text'));
    expect(localStorage.getItem('polingu_transcriptFontSize')).toBe('small');
    expect(control('Smaller text')).toBeDisabled();
    expect(control('Larger text')).toBeEnabled();
  });

  test('a book opened once can be read again offline', async () => {
    const app = renderApp('/reader/b1');
    await screen.findByText('Izabela');
    app.unmount();

    network.goOffline();
    renderApp('/reader/b1');
    expect(await screen.findByText('Izabela')).toBeInTheDocument();
    expect(downloads).toHaveLength(1);
  });

  test('a book never opened online explains that it is not available offline', async () => {
    network.goOffline();
    renderApp('/reader/b1');
    expect(
      await screen.findByText('Text not available offline. Open this book once while online.')
    ).toBeInTheDocument();
  });

  test('a text that cannot be downloaded explains the failure, logging the real error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => ({ ok: false, text: async () => '' }));
    renderApp('/reader/b1');
    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('Failed to load text content.')).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to load book:',
      expect.objectContaining({ message: 'Failed to load text content.' })
    );
  });

  test('Retry loads the book again once the connection is back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    renderApp('/reader/b1');
    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).toBeNull();

    vi.stubGlobal('fetch', async () => ({ ok: true, text: async () => TEXT }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Izabela')).toBeInTheDocument();
  });

  test('a book that failed to load offers a way back to the library', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    renderApp('/reader/b1');
    fireEvent.click(await screen.findByRole('link', { name: 'Back to Library' }));
    expect(await screen.findByText('My Library')).toBeInTheDocument();
  });

  test('a book that does not exist says so', async () => {
    renderApp('/reader/missing');
    expect(await screen.findByText('Book not found')).toBeInTheDocument();
  });
});

describe('Reading a PDF', () => {
  beforeEach(async () => {
    pdfFile.reset();
    await seedBooks(UID, [
      book('b1', {
        title: 'Ferdydurke',
        fileType: 'pdf',
        pageCount: 5,
        storagePath: `books/users/${UID}/b1/f.pdf`,
      }),
    ]);
    // A canvas the viewer can draw into, so pages finish rendering.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: () => {},
    } as unknown as CanvasRenderingContext2D);
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      value: 1000,
    });
  });

  afterEach(() => {
    // jsdom defines these on Element.prototype, so removing the overrides restores them.
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  async function openPdf(progress?: Partial<ReadingProgress>) {
    if (progress) {
      seedReadingProgress(UID, {
        bookId: 'b1',
        currentPage: 1,
        scrollPercent: 0,
        lastReadAt: 1,
        ...progress,
      });
    }
    renderApp('/reader/b1');
    return screen.findByText(/^\d+ \/ 5$/);
  }

  const pageLabel = () => screen.getByText(/^\d+ \/ 5$/).textContent;
  const iconButton = (icon: string) => screen.getByTestId(icon).closest('button') as HTMLElement;

  test('loads the book’s file and opens at the saved page', async () => {
    await openPdf({ currentPage: 3 });
    expect(pageLabel()).toBe('3 / 5');
    expect(pdfFile.loaded).toEqual([`https://storage.test/books/users/${UID}/b1/f.pdf`]);
  });

  test('pages with the arrow buttons and keys, stopping at either end', async () => {
    await openPdf({ currentPage: 4 });
    fireEvent.click(iconButton('ChevronRightIcon'));
    expect(pageLabel()).toBe('5 / 5');
    expect(iconButton('ChevronRightIcon')).toBeDisabled();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(pageLabel()).toBe('5 / 5');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(pageLabel()).toBe('3 / 5');
    fireEvent.click(iconButton('ChevronLeftIcon'));
    fireEvent.click(iconButton('ChevronLeftIcon'));
    expect(pageLabel()).toBe('1 / 5');
    expect(iconButton('ChevronLeftIcon')).toBeDisabled();
  });

  test('the page reached is saved when leaving the book', async () => {
    await openPdf({ currentPage: 1 });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await leaveReader('Ferdydurke');
    await waitFor(() =>
      expect(savedProgress()).toMatchObject({ currentPage: 3, scrollPercent: 0.6 })
    );
  });

  test('bookmarking a page saves it and marks it on the progress bar, which jumps back to it', async () => {
    await openPdf({ currentPage: 2 });
    fireEvent.click(control('Add bookmark'));
    await waitFor(() => expect(savedProgress()?.bookmarks).toEqual([2]));
    expect(control('Remove bookmark')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(pageLabel()).toBe('4 / 5');
    fireEvent.click(screen.getByLabelText('Page 2'));
    expect(pageLabel()).toBe('2 / 5');
  });

  test('the progress bar jumps to the page under a click, and follows a drag', async () => {
    await openPdf({ currentPage: 1, bookmarks: [2] });
    // The bar's track is 500px wide; the bookmark marker sits on it.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 500,
      top: 0,
      bottom: 24,
      right: 500,
      height: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const bar = screen.getByLabelText('Page 2').parentElement!.parentElement!;

    fireEvent.click(bar, { clientX: 400 });
    expect(pageLabel()).toBe('4 / 5');

    fireEvent.mouseDown(bar, { clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 300 });
    expect(screen.getByText('Page 3')).toBeInTheDocument();
    fireEvent.mouseUp(window);
    expect(pageLabel()).toBe('3 / 5');
  });

  test('zooming is limited to steps of 10% and remembered for the book', async () => {
    await openPdf();
    const zoom = within(screen.getByText('100%').parentElement!);
    const zoomIn = zoom.getByTestId('AddIcon').closest('button')!;
    const zoomOut = zoom.getByTestId('RemoveIcon').closest('button')!;
    fireEvent.click(zoomIn);
    fireEvent.click(zoomIn);
    expect(screen.getByText('120%')).toBeInTheDocument();
    fireEvent.click(zoomOut);
    expect(screen.getByText('110%')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem('polingu_zoom_b1')).toBe('1.1'));
  });

  test('a remembered zoom is used when the book is opened again', async () => {
    localStorage.setItem('polingu_zoom_b1', '1.5');
    await openPdf();
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  test('the words on the page are laid over it so they can be tapped, joining hyphenated words', async () => {
    pdfFile.text[1] = ['Mama zawsze mówiła', 'że Józio jest niedo-', 'jrzały.'];
    await openPdf();
    for (const word of ['Mama', 'zawsze', 'mówiła', 'Józio']) {
      expect(await screen.findByText(word)).toBeInTheDocument();
    }
    // A word hyphenated across two lines is offered whole on both halves.
    expect(screen.getAllByText('niedojrzały.')).toHaveLength(2);
  });

  test('a PDF that cannot be opened shows an error', async () => {
    pdfFile.broken = true;
    renderApp('/reader/b1');
    expect(await screen.findByText('Failed to load PDF')).toBeInTheDocument();
  });

  test('a PDF whose download link cannot be fetched shows an error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    uploads.downloadFails = true;
    renderApp('/reader/b1');
    expect(await screen.findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
