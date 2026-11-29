/**
 * Tap-to-translate on a flashcard sentence, rendered with renderTappableText the way
 * SentenceFlashcard and DeclensionFlashcard do. Only the Cloud Function is faked.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderTappableText } from '../../src/lib/renderTappableText';
import { resetCallables } from './support/fakeFunctions';
import {
  dailyLimitError,
  fakeTranslateServer,
  functionsError,
  minuteLimitError,
  resetTimeIn,
  type FakeTranslateServer,
} from './support/translateServer';
import {
  limitDialog,
  nextTick,
  pressOutside,
  renderInApp,
  settle,
  stubClipboard,
  tap,
} from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

const SENTENCE = 'Kot pije mleko.';

let server: FakeTranslateServer;
let restoreClipboard: (() => void) | undefined;

beforeEach(() => {
  resetCallables();
  server = fakeTranslateServer({ kot: 'cat', pije: 'drinks (pić)', mleko: 'milk' });
});

afterEach(() => {
  restoreClipboard?.();
  restoreClipboard = undefined;
});

type Options = Parameters<typeof renderTappableText>[1];

interface Setup {
  text?: string;
  isAdmin?: boolean;
  vocabulary?: boolean;
  /** The declined form a declension card highlights. */
  highlight?: string;
}

function renderSentence(
  options: Partial<Options> = {},
  { text = SENTENCE, isAdmin = false, vocabulary = true, highlight }: Setup = {}
) {
  return renderInApp(
    <p>
      {renderTappableText(
        text,
        { sentenceContext: text, sentenceId: 's-1', ...options },
        highlight
      )}
    </p>,
    { isAdmin, vocabulary }
  );
}

const word = (text: string) => screen.getByText(text, { selector: '[data-word-index]' });
const tooltip = () => screen.getByRole('tooltip');
const tooltips = () => screen.queryAllByRole('tooltip');

describe('tapping a word', () => {
  test('shows the translation of the bare word, looked up in its sentence', async () => {
    renderSentence();

    tap(word('mleko.'));
    await settle();

    expect(tooltip()).toHaveTextContent('milk');
    expect(server.requests()).toEqual([
      { text: 'mleko', targetLang: 'EN', context: SENTENCE, sentenceId: 's-1' },
    ]);
  });

  test('shows a spinner until the translation arrives', async () => {
    server.hold();
    renderSentence();

    tap(word('pije'));
    await settle();
    expect(within(tooltip()).getByRole('progressbar')).toBeInTheDocument();

    await server.answer('pije', 'drinks (pić)');
    expect(within(tooltip()).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(tooltip()).toHaveTextContent('drinks (pić)');
  });

  test('sends the declension card id when the sentence belongs to a declension card', async () => {
    renderSentence({ sentenceId: undefined, declensionCardId: 7 });

    tap(word('Kot'));
    await settle();

    expect(server.requests()).toEqual([
      { text: 'kot', targetLang: 'EN', context: SENTENCE, declensionCardId: 7 },
    ]);
  });

  test("uses the sentence's cached translation without calling the server", async () => {
    renderSentence({ translations: { kot: 'cat (saved)' } });

    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat (saved)');
    expect(server.requests()).toEqual([]);
  });

  test('tapping the open word again closes its translation', async () => {
    renderSentence();

    tap(word('Kot'));
    await settle();
    expect(tooltip()).toHaveTextContent('cat');

    tap(word('Kot'));
    await settle();
    expect(tooltips()).toHaveLength(0);
  });

  test('only one translation is open at a time: tapping another word closes the open one first', async () => {
    renderSentence();

    tap(word('Kot'));
    await settle();
    expect(tooltip()).toHaveTextContent('cat');

    tap(word('pije'));
    await settle();
    expect(tooltips()).toHaveLength(0);

    tap(word('pije'));
    await settle();
    expect(tooltips()).toHaveLength(1);
    expect(tooltip()).toHaveTextContent('drinks (pić)');
  });

  test('pressing outside closes the translation, pressing inside it does not', async () => {
    renderSentence();
    tap(word('Kot'));
    await settle();
    await nextTick();

    fireEvent.mouseDown(within(tooltip()).getByText('cat'));
    await settle();
    expect(tooltip()).toHaveTextContent('cat');

    pressOutside();
    await settle();
    expect(tooltips()).toHaveLength(0);
  });

  test('the highlighted (declined) form is marked out from the rest of the sentence', () => {
    renderSentence({}, { highlight: 'MLEKO' });

    expect(getComputedStyle(word('mleko.')).fontWeight).toBe('600');
    expect(getComputedStyle(word('Kot')).fontWeight).not.toBe('600');
  });
});

describe('translation errors in the word tooltip', () => {
  test('a per-minute rate limit says "Too many requests" and warns', async () => {
    server.failWith(minuteLimitError());
    const { showSnackbar } = renderSentence();

    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('Too many requests');
    expect(showSnackbar).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment.',
      'warning'
    );
  });

  test('any other failure says "Translation failed" and shows an error', async () => {
    server.failWith(functionsError('internal', 'Translation failed. Please try again.'));
    const { showSnackbar } = renderSentence();

    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('Translation failed');
    expect(showSnackbar).toHaveBeenCalledWith('Translation failed. Please try again.', 'error');
  });

  test('reaching the daily limit closes the tooltip and says when the limit resets', async () => {
    server.failWith(dailyLimitError(resetTimeIn(150)));
    const { showSnackbar } = renderSentence();

    tap(word('Kot'));
    await settle();

    expect(tooltips()).toHaveLength(0);
    expect(limitDialog()).toHaveTextContent('Your limit will reset in 2 hours 30 minutes');
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  test('a new tap after a failure tries again and shows the translation', async () => {
    server.hold();
    renderSentence();
    tap(word('Kot'));
    await server.fail('kot', new Error('offline'));
    expect(tooltip()).toHaveTextContent('Translation failed');

    tap(word('Kot'));
    await settle();
    tap(word('Kot'));
    await server.answer('kot', 'cat');

    expect(tooltip()).toHaveTextContent('cat');
    expect(tooltip()).not.toHaveTextContent('Translation failed');
  });
});

describe('saving or copying a tapped word', () => {
  test('"Add to vocabulary" hands over the word and its translation and closes the tooltip', async () => {
    const { openAddToVocabulary } = renderSentence();
    tap(word('mleko.'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Add to vocabulary' }));
    await settle();

    expect(openAddToVocabulary).toHaveBeenCalledWith('mleko.', 'milk');
    expect(tooltips()).toHaveLength(0);
  });

  test('there is no "Add to vocabulary" button where vocabulary cannot be added', async () => {
    renderSentence({}, { vocabulary: false });
    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat');
    expect(screen.queryByRole('button', { name: 'Add to vocabulary' })).not.toBeInTheDocument();
  });

  test('"Copy" puts the tapped word on the clipboard and confirms', async () => {
    const clipboard = stubClipboard();
    restoreClipboard = clipboard.restore;
    const { showSnackbar } = renderSentence();
    tap(word('Kot'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await settle();

    expect(clipboard.writeText).toHaveBeenCalledWith('Kot');
    expect(showSnackbar).toHaveBeenCalledWith('Copied to clipboard', 'success');
  });

  test('a failed copy says so', async () => {
    const clipboard = stubClipboard(
      vi.fn(async () => {
        throw new Error('denied');
      })
    );
    restoreClipboard = clipboard.restore;
    const { showSnackbar } = renderSentence();
    tap(word('Kot'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await settle();

    expect(showSnackbar).toHaveBeenCalledWith('Failed to copy', 'error');
  });
});

describe('correcting a translation (admins)', () => {
  const editButton = () => screen.getByTestId('EditIcon').closest('button')!;

  test('learners who are not admins cannot edit the translation', async () => {
    renderSentence({ onUpdateTranslation: vi.fn() });
    tap(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat');
    expect(screen.queryByTestId('EditIcon')).not.toBeInTheDocument();
  });

  test('an admin can replace the translation; the trimmed text is saved under the bare word', async () => {
    const onUpdateTranslation = vi.fn();
    renderSentence({ onUpdateTranslation }, { isAdmin: true });
    tap(word('Kot'));
    await settle();

    fireEvent.click(editButton());
    const input = within(tooltip()).getByRole('textbox');
    expect(input).toHaveValue('cat');
    fireEvent.change(input, { target: { value: '  tomcat ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(onUpdateTranslation).toHaveBeenCalledWith('kot', 'tomcat');
    expect(within(tooltip()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(tooltip()).toHaveTextContent('tomcat');
  });

  test('Escape abandons the edit and keeps the old translation', async () => {
    const onUpdateTranslation = vi.fn();
    renderSentence({ onUpdateTranslation }, { isAdmin: true });
    tap(word('Kot'));
    await settle();

    fireEvent.click(editButton());
    const input = within(tooltip()).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'dog' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();

    expect(onUpdateTranslation).not.toHaveBeenCalled();
    expect(tooltip()).toHaveTextContent('cat');
  });

  test('saving an unchanged or blank translation saves nothing', async () => {
    const onUpdateTranslation = vi.fn();
    renderSentence({ onUpdateTranslation }, { isAdmin: true });
    tap(word('Kot'));
    await settle();

    fireEvent.click(editButton());
    fireEvent.keyDown(within(tooltip()).getByRole('textbox'), { key: 'Enter' });
    await settle();
    fireEvent.click(editButton());
    fireEvent.change(within(tooltip()).getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(within(tooltip()).getByRole('textbox'), { key: 'Enter' });
    await settle();

    expect(onUpdateTranslation).not.toHaveBeenCalled();
    expect(tooltip()).toHaveTextContent('cat');
  });

  test('a failed save keeps the editor open with what the admin typed', async () => {
    const onUpdateTranslation = vi.fn(() => {
      throw new Error('permission denied');
    });
    renderSentence({ onUpdateTranslation }, { isAdmin: true });
    tap(word('Kot'));
    await settle();

    fireEvent.click(editButton());
    fireEvent.change(within(tooltip()).getByRole('textbox'), { target: { value: 'tomcat' } });
    fireEvent.click(screen.getByTestId('CheckIcon').closest('button')!);
    await settle();

    expect(onUpdateTranslation).toHaveBeenCalledWith('kot', 'tomcat');
    expect(within(tooltip()).getByRole('textbox')).toHaveValue('tomcat');
  });
});

describe('out-of-order and cached lookups', () => {
  test('a late answer for a previously tapped word never replaces the open word', async () => {
    server.hold();
    renderSentence();

    tap(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();
    tap(word('pije'));
    await settle();

    await server.answer('pije', 'drinks');
    expect(tooltip()).toHaveTextContent('drinks');

    await server.answer('kot', 'cat');
    expect(tooltip()).toHaveTextContent('drinks');
  });

  test('a word inside Polish quotation marks uses the cached translation of the bare word', async () => {
    renderSentence({ translations: { kot: 'cat (saved)' } }, { text: '„Kot” pije mleko.' });

    tap(word('„Kot”'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat (saved)');
    expect(server.requests()).toEqual([]);
  });

  test('tapping a token that is only punctuation sends no empty lookup', async () => {
    const { showSnackbar } = renderSentence({}, { text: 'Kot ? pije' });

    tap(word('?'));
    await settle();

    expect(server.texts()).not.toContain('');
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});
