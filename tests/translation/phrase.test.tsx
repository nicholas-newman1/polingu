/**
 * Selecting a phrase in a tappable sentence (mouse drag or touch long-press and
 * slide) translates the whole phrase. Only the Cloud Function is faked.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderTappableText } from '../../src/lib/renderTappableText';
import { resetCallables } from './support/fakeFunctions';
import {
  dailyLimitError,
  fakeTranslateServer,
  minuteLimitError,
  RESET_TIME,
  type FakeTranslateServer,
} from './support/translateServer';
import {
  elapse,
  fingerOver,
  mouseDrag,
  nextTick,
  pressOutside,
  renderInApp,
  settle,
  stubClipboard,
  tap,
  touch,
} from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

const SENTENCE = 'Dzień dobry, jak się masz?';

let server: FakeTranslateServer;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  resetCallables();
  server = fakeTranslateServer({
    'Dzień dobry,': 'Good morning,',
    'jak się masz?': 'how are you?',
    jak: 'how',
    się: 'oneself',
  });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

type Options = Parameters<typeof renderTappableText>[1];

function renderSentence(
  options: Partial<Options> = {},
  app: { vocabulary?: boolean; sentences?: boolean } = {}
) {
  return renderInApp(
    <p>
      {renderTappableText(SENTENCE, { sentenceContext: SENTENCE, sentenceId: 's-9', ...options })}
    </p>,
    app
  );
}

const word = (text: string) => screen.getByText(text, { selector: '[data-word-index]' });
const tooltip = () => screen.getByRole('tooltip');
const tooltips = () => screen.queryAllByRole('tooltip');
/** Whether a word is shown as part of the current selection. */
const looksSelected = (el: Element) => {
  const background = getComputedStyle(el).backgroundColor;
  return background !== '' && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)';
};

describe('selecting a phrase with the mouse', () => {
  test('dragging across words translates the phrase in its sentence', async () => {
    renderSentence();

    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    expect(tooltip()).toHaveTextContent('Good morning,');
    expect(server.requests()).toEqual([
      { text: 'Dzień dobry,', targetLang: 'EN', context: SENTENCE, sentenceId: 's-9' },
    ]);
  });

  test('the selected words are highlighted while dragging and stay highlighted with the translation', async () => {
    server.hold();
    renderSentence();

    fireEvent.mouseDown(word('jak'), { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 20, clientY: 0 });
    fireEvent.mouseEnter(word('się'));
    await settle();
    expect(looksSelected(word('jak'))).toBe(true);
    expect(looksSelected(word('się'))).toBe(true);
    expect(looksSelected(word('masz?'))).toBe(false);

    fireEvent.mouseEnter(word('masz?'));
    fireEvent.mouseUp(word('masz?'));
    await settle();
    expect(within(tooltip()).getByRole('progressbar')).toBeInTheDocument();
    expect(looksSelected(word('masz?'))).toBe(true);
    expect(looksSelected(word('dobry,'))).toBe(false);

    await server.answer('jak się masz?', 'how are you?');
    expect(tooltip()).toHaveTextContent('how are you?');
  });

  test('dragging right to left gives the phrase in reading order', async () => {
    renderSentence();

    mouseDrag(word('masz?'), word('się'), word('jak'));
    await settle();

    expect(server.texts()).toEqual(['jak się masz?']);
    expect(tooltip()).toHaveTextContent('how are you?');
  });

  test('sweeping back to the starting word selects nothing and translates nothing', async () => {
    renderSentence();

    mouseDrag(word('jak'), word('się'), word('jak'));
    await settle();

    expect(server.requests()).toEqual([]);
    expect(tooltips()).toHaveLength(0);
    expect(looksSelected(word('jak'))).toBe(false);
    expect(looksSelected(word('się'))).toBe(false);
  });

  test('a small wobble while pressing is a tap, not a selection', async () => {
    renderSentence();

    fireEvent.mouseDown(word('jak'), { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 2, clientY: 2 });
    await settle();
    expect(looksSelected(word('jak'))).toBe(false);
    fireEvent.mouseUp(word('jak'));
    fireEvent.click(word('jak'));
    await settle();

    expect(server.texts()).toEqual(['jak']);
    expect(tooltip()).toHaveTextContent('how');
  });

  test('a small wobble while tapping the open word still closes it', async () => {
    renderSentence();
    tap(word('jak'));
    await settle();
    expect(tooltip()).toHaveTextContent('how');

    fireEvent.mouseDown(word('jak'), { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 2, clientY: 2 });
    fireEvent.mouseUp(word('jak'));
    fireEvent.click(word('jak'));
    await settle();

    expect(tooltips()).toHaveLength(0);
    expect(server.texts()).toEqual(['jak']);
  });

  test('a right-button drag does not select', async () => {
    renderSentence();

    fireEvent.mouseDown(word('jak'), { button: 2, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 0 });
    fireEvent.mouseEnter(word('się'));
    fireEvent.mouseUp(word('się'));
    await settle();

    // The pointer passing over "się" is an ordinary hover; no phrase is looked up.
    expect(server.texts()).toEqual(['się']);
    expect(tooltip()).toHaveTextContent('oneself');
    expect(looksSelected(word('jak'))).toBe(false);
    expect(looksSelected(word('się'))).toBe(false);
  });

  test('starting a selection closes an open word translation', async () => {
    renderSentence();
    tap(word('jak'));
    await settle();
    expect(tooltip()).toHaveTextContent('how');

    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    expect(tooltips()).toHaveLength(1);
    expect(tooltip()).toHaveTextContent('Good morning,');
  });

  test('hovering a word while a phrase is shown does not open a word translation', async () => {
    renderSentence();
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    fireEvent.mouseEnter(word('jak'));
    await settle();

    expect(tooltips()).toHaveLength(1);
    expect(server.texts()).toEqual(['Dzień dobry,']);
  });
});

describe('closing a phrase translation', () => {
  test('pressing outside closes it and clears the selection', async () => {
    renderSentence();
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();
    await nextTick();

    fireEvent.mouseDown(within(tooltip()).getByText('Good morning,'));
    await settle();
    expect(tooltip()).toHaveTextContent('Good morning,');

    pressOutside();
    await settle();
    expect(tooltips()).toHaveLength(0);
    expect(looksSelected(word('Dzień'))).toBe(false);
  });

  test('tapping a selected word closes the phrase translation', async () => {
    renderSentence();
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    fireEvent.click(word('Dzień'));
    await settle();

    expect(tooltips()).toHaveLength(0);
    expect(looksSelected(word('dobry,'))).toBe(false);
  });
});

describe('selecting a phrase by touch', () => {
  test('a long press then a slide selects and translates the phrase', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderSentence();
    let under: Element | null = word('jak');
    cleanups.push(fingerOver(() => under));

    touch(word('jak'), 'touchstart', [{ clientX: 0, clientY: 0 }]);
    await elapse(400);
    under = word('masz?');
    const move = touch(document, 'touchmove', [{ clientX: 80, clientY: 0 }]);
    touch(document, 'touchend', []);
    await settle();

    expect(move.defaultPrevented).toBe(true);
    expect(server.texts()).toEqual(['jak się masz?']);
    expect(tooltip()).toHaveTextContent('how are you?');
  });

  test('moving the finger before the long press completes is a scroll, not a selection', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderSentence();
    cleanups.push(fingerOver(() => word('masz?')));

    touch(word('jak'), 'touchstart', [{ clientX: 0, clientY: 0 }]);
    const firstMove = touch(document, 'touchmove', [{ clientX: 0, clientY: 30 }]);
    await elapse(400);
    // The long-press delay has passed mid-scroll: nothing is selected and the
    // rest of the scroll is not blocked.
    expect(looksSelected(word('jak'))).toBe(false);
    const laterMove = touch(document, 'touchmove', [{ clientX: 80, clientY: 60 }]);
    touch(document, 'touchend', []);
    await settle();

    expect(firstMove.defaultPrevented).toBe(false);
    expect(laterMove.defaultPrevented).toBe(false);
    expect(server.requests()).toEqual([]);
    expect(looksSelected(word('jak'))).toBe(false);
  });

  test('a quick touch is a tap: it opens the word translation, which stays open', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderSentence();

    touch(word('jak'), 'touchstart', [{ clientX: 0, clientY: 0 }]);
    await elapse(100);
    touch(document, 'touchend', []);
    fireEvent.click(word('jak'));
    await settle();
    expect(tooltip()).toHaveTextContent('how');

    // Well past the long-press delay, the touch must not turn into a selection.
    await elapse(1000);
    expect(tooltip()).toHaveTextContent('how');
    expect(looksSelected(word('jak'))).toBe(false);
    expect(server.texts()).toEqual(['jak']);
  });

  test('a long press does not open the browser menu over the word', () => {
    renderSentence();

    expect(fireEvent.contextMenu(word('jak'))).toBe(false);
  });

  test('a long press without sliding selects nothing', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderSentence();

    touch(word('jak'), 'touchstart', [{ clientX: 0, clientY: 0 }]);
    await elapse(400);
    expect(looksSelected(word('jak'))).toBe(true);
    touch(document, 'touchend', []);
    await settle();

    expect(server.requests()).toEqual([]);
    expect(looksSelected(word('jak'))).toBe(false);
  });
});

describe('caching phrase translations', () => {
  test("a phrase in the sentence's cache is shown without calling the server", async () => {
    renderSentence({ translations: { 'dzień dobry': 'Hello (saved)' } });

    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    expect(tooltip()).toHaveTextContent('Hello (saved)');
    expect(server.requests()).toEqual([]);
  });

  test('a fresh phrase translation is handed back under its cache key', async () => {
    const onUpdateTranslation = vi.fn();
    renderSentence({ onUpdateTranslation });

    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    expect(onUpdateTranslation).toHaveBeenCalledWith('dzień dobry', 'Good morning,');
  });

  test('a late answer for an earlier selection never replaces the current phrase', async () => {
    server.hold();
    renderSentence();

    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();
    mouseDrag(word('jak'), word('się'), word('masz?'));
    await settle();

    await server.answer('jak się masz?', 'how are you?');
    expect(tooltip()).toHaveTextContent('how are you?');

    await server.answer('Dzień dobry,', 'Good morning,');
    expect(tooltip()).toHaveTextContent('how are you?');
  });
});

describe('phrase translation errors', () => {
  test('a per-minute rate limit says "Too many requests" and warns', async () => {
    server.failWith(minuteLimitError());
    const { showSnackbar } = renderSentence();

    mouseDrag(word('jak'), word('się'));
    await settle();

    expect(tooltip()).toHaveTextContent('Too many requests');
    expect(showSnackbar).toHaveBeenCalledWith(
      'Too many requests. Please wait a moment.',
      'warning'
    );
  });

  test('any other failure says "Translation failed"', async () => {
    server.failWith(new Error('offline'));
    const { showSnackbar } = renderSentence();

    mouseDrag(word('jak'), word('się'));
    await settle();

    expect(tooltip()).toHaveTextContent('Translation failed');
    expect(showSnackbar).toHaveBeenCalledWith('Translation failed. Please try again.', 'error');
  });

  test('reaching the daily limit closes the phrase and reports when the limit resets', async () => {
    server.failWith(dailyLimitError());
    const onDailyLimitReached = vi.fn();
    renderSentence({ onDailyLimitReached });

    mouseDrag(word('jak'), word('się'));
    await settle();

    expect(tooltips()).toHaveLength(0);
    expect(onDailyLimitReached).toHaveBeenCalledWith(RESET_TIME);
    expect(looksSelected(word('jak'))).toBe(false);
  });
});

describe('saving or copying a phrase', () => {
  test('"Save" then "Vocab" hands the phrase and its translation to the vocabulary form', async () => {
    const { openAddToVocabulary, openAddSentence } = renderSentence();
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to vocabulary' }));
    await settle();

    expect(openAddToVocabulary).toHaveBeenCalledWith('Dzień dobry,', 'Good morning,');
    expect(openAddSentence).not.toHaveBeenCalled();
    expect(tooltips()).toHaveLength(0);
  });

  test('"Save" then "Sentence" hands the phrase and its translation to the sentence form', async () => {
    const { openAddToVocabulary, openAddSentence } = renderSentence();
    mouseDrag(word('jak'), word('się'), word('masz?'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add as sentence' }));
    await settle();

    expect(openAddSentence).toHaveBeenCalledWith({
      polish: 'jak się masz?',
      english: 'how are you?',
    });
    expect(openAddToVocabulary).not.toHaveBeenCalled();
    expect(tooltips()).toHaveLength(0);
  });

  test('the save choices are gone the next time a phrase is selected', async () => {
    renderSentence();
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Add as sentence' })).toBeInTheDocument();

    mouseDrag(word('jak'), word('się'));
    await settle();

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add as sentence' })).not.toBeInTheDocument();
  });

  test('there is no "Save" button where neither vocabulary nor sentences can be added', async () => {
    renderSentence({}, { vocabulary: false, sentences: false });
    mouseDrag(word('Dzień'), word('dobry,'));
    await settle();

    expect(tooltip()).toHaveTextContent('Good morning,');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  test('"Copy" puts the selected phrase on the clipboard', async () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    const { showSnackbar } = renderSentence();
    mouseDrag(word('jak'), word('się'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await settle();

    expect(clipboard.writeText).toHaveBeenCalledWith('jak się');
    expect(showSnackbar).toHaveBeenCalledWith('Copied to clipboard', 'success');
  });

  test('a failed copy says so', async () => {
    const clipboard = stubClipboard(
      vi.fn(async () => {
        throw new Error('denied');
      })
    );
    cleanups.push(clipboard.restore);
    const { showSnackbar } = renderSentence();
    mouseDrag(word('jak'), word('się'));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
    await settle();

    expect(showSnackbar).toHaveBeenCalledWith('Failed to copy', 'error');
  });
});
