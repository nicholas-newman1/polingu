/**
 * The translator from the bottom menu: free text in either direction, with the daily
 * limit tracked by TranslationProvider. Only the Cloud Function is faked.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { TranslatorModal } from '../../src/components/BottomMenu/TranslatorModal';
import { TranslationProvider } from '../../src/contexts/TranslationContext';
import { useTranslationContext } from '../../src/hooks/useTranslationContext';
import { TRANSLATION_DEBOUNCE_MS } from '../../src/constants/translation';
import { renderTappableText } from '../../src/lib/renderTappableText';
import { resetCallables } from './support/fakeFunctions';
import {
  dailyLimitError,
  fakeTranslateServer,
  minuteLimitError,
  RESET_TIME,
  type FakeTranslateServer,
} from './support/translateServer';
import { elapse, renderInApp, stubClipboard, tap } from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

const NOW = new Date('2026-11-26T15:00:00Z');
const TODAY = '2026-11-26';

let server: FakeTranslateServer;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  resetCallables();
  server = fakeTranslateServer({
    'Good morning': 'Dzień dobry',
    '  Good morning ': ' Dzień dobry\n',
    cat: 'kot',
    dog: 'pies',
    kot: 'cat',
    'Kot śpi.': 'The cat is sleeping.',
  });
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

/** The page around the translator: a way to open it, and the daily-limit notice. */
function Page() {
  const { openTranslator, showLimitReached, limitResetTime, closeLimitReached } =
    useTranslationContext();
  return (
    <>
      <button onClick={openTranslator}>Open translator</button>
      {showLimitReached && (
        <div role="alert">
          Daily limit reached until {limitResetTime}
          <button onClick={closeLimitReached}>OK</button>
        </div>
      )}
      <TranslatorModal />
    </>
  );
}

function renderTranslator(options: Parameters<typeof renderInApp>[1] = {}) {
  return renderInApp(
    <TranslationProvider>
      <Page />
    </TranslationProvider>,
    options
  );
}

async function openTranslator() {
  fireEvent.click(screen.getByRole('button', { name: 'Open translator' }));
  await elapse(300);
}

const dialog = () => screen.getByRole('dialog');
const input = () => within(dialog()).getByRole('textbox');
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
/** Waits out the typing pause after which the translator sends the text. */
const pause = () => elapse(TRANSLATION_DEBOUNCE_MS);
const directionToggle = () => within(dialog()).getByRole('button', { name: /^(EN|PL).*(PL|EN)$/ });
const storedUsage = () => JSON.parse(localStorage.getItem('translationUsage') ?? 'null');

describe('translating in the translator', () => {
  test('English typed in is translated into Polish once typing pauses', async () => {
    renderTranslator();
    await openTranslator();
    expect(input()).toHaveAttribute('placeholder', 'Enter English text...');
    expect(dialog()).toHaveTextContent('Translation will appear here');

    type('Good morning');
    await elapse(TRANSLATION_DEBOUNCE_MS - 1);
    expect(server.requests()).toEqual([]);

    await elapse(1);
    expect(server.requests()).toEqual([{ text: 'Good morning', targetLang: 'PL' }]);
    expect(dialog()).toHaveTextContent('Dzień dobry');
  });

  test('while the learner keeps typing, only the final text is translated', async () => {
    renderTranslator();
    await openTranslator();

    type('G');
    await elapse(200);
    type('Good');
    await elapse(200);
    type('Good morning');
    await pause();

    expect(server.texts()).toEqual(['Good morning']);
  });

  test('a spinner shows while the translation is on its way', async () => {
    server.hold();
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();
    expect(within(dialog()).getByRole('progressbar')).toBeInTheDocument();

    await server.answer('cat', 'kot');
    expect(within(dialog()).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(dialog()).toHaveTextContent('kot');
  });

  test('an answer for text the learner has since changed is never shown', async () => {
    server.hold();
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();
    type('dog');
    await pause();
    await server.answer('dog', 'pies');
    await server.answer('cat', 'kot');

    expect(dialog()).toHaveTextContent('pies');
    expect(dialog()).not.toHaveTextContent('kot');
  });

  test('swapping the direction moves the Polish result into the box and translates it to English', async () => {
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();
    expect(dialog()).toHaveTextContent('kot');

    fireEvent.click(directionToggle());
    expect(input()).toHaveValue('kot');
    expect(input()).toHaveAttribute('placeholder', 'Wpisz tekst po polsku...');
    await pause();

    expect(server.requests()).toEqual([
      { text: 'cat', targetLang: 'PL' },
      { text: 'kot', targetLang: 'EN' },
    ]);
    expect(dialog()).toHaveTextContent('cat');
  });

  test('swapping the direction before a result arrives drops that result and translates the text the other way', async () => {
    server.hold();
    renderTranslator();
    await openTranslator();
    type('kot');
    await pause();

    fireEvent.click(directionToggle());
    await server.answer('kot', 'cat (as English→Polish)');

    expect(dialog()).not.toHaveTextContent('cat (as English→Polish)');
    expect(input()).toHaveValue('kot');

    await pause();
    expect(server.requests()).toEqual([
      { text: 'kot', targetLang: 'PL' },
      { text: 'kot', targetLang: 'EN' },
    ]);
    await server.answer('kot', 'cat');
    expect(dialog()).toHaveTextContent('cat');
  });

  test('clearing the text clears the result, and blank text is not sent', async () => {
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();
    expect(dialog()).toHaveTextContent('kot');

    type('   ');
    await pause();

    expect(dialog()).toHaveTextContent('Translation will appear here');
    expect(server.texts()).toEqual(['cat']);
  });

  test('the character count shows how much of the 500-character limit is used', async () => {
    renderTranslator();
    await openTranslator();

    type('Good morning');

    expect(dialog()).toHaveTextContent('12 / 500');
    expect(input()).toHaveAttribute('maxlength', '500');
  });
});

describe('translator errors', () => {
  test('the per-minute limit asks the learner to wait', async () => {
    server.failWith(minuteLimitError());
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();

    expect(dialog()).toHaveTextContent('Too many requests. Please wait a moment.');
  });

  test('any other failure says the translation failed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.failWith(new Error('internal'));
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();

    expect(dialog()).toHaveTextContent('Translation failed. Please try again.');
    expect(consoleError).toHaveBeenCalled();
  });

  test('an aborted request is not reported as an error', async () => {
    server.failWith(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();

    expect(dialog()).not.toHaveTextContent('failed');
    expect(dialog()).toHaveTextContent('Translation will appear here');
  });

  test('reaching the daily limit closes the translator and says when it resets', async () => {
    server.failWith(dailyLimitError());
    renderTranslator();
    await openTranslator();

    type('cat');
    await pause();
    await elapse(500);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(`Daily limit reached until ${RESET_TIME}`);
    expect(storedUsage()).toEqual({ charsUsed: 1500, date: TODAY, resetTime: RESET_TIME });
  });
});

describe('the daily translation limit', () => {
  test('after the limit is reached, opening the translator shows the limit instead', async () => {
    server.failWith(dailyLimitError());
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();
    await elapse(500);
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await openTranslator();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(RESET_TIME);
  });

  test('usage reported with each translation is remembered, and a full day blocks the translator', async () => {
    server.setCharsUsedToday(1497);
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();
    expect(storedUsage()).toEqual({ charsUsed: 1500, date: TODAY, resetTime: RESET_TIME });

    fireEvent.click(within(dialog()).getByRole('button', { name: 'close' }));
    await elapse(500);
    await openTranslator();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('usage under the limit still lets the translator open', async () => {
    server.setCharsUsedToday(100);
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'close' }));
    await elapse(500);

    await openTranslator();

    expect(dialog()).toBeInTheDocument();
    expect(storedUsage().charsUsed).toBe(103);
  });

  test('a limit reached earlier today is remembered across app restarts', async () => {
    localStorage.setItem(
      'translationUsage',
      JSON.stringify({ charsUsed: 1500, date: TODAY, resetTime: RESET_TIME })
    );
    renderTranslator();

    await openTranslator();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(RESET_TIME);
  });

  test("yesterday's usage does not count against today", async () => {
    localStorage.setItem(
      'translationUsage',
      JSON.stringify({ charsUsed: 1500, date: '2026-11-25', resetTime: '2026-11-26T00:00:00.000Z' })
    );
    renderTranslator();

    await openTranslator();

    expect(dialog()).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a daily limit hit by tapping a word also blocks the translator', async () => {
    server.failWith(dailyLimitError());
    function FlashcardPage() {
      const { handleDailyLimitReached } = useTranslationContext();
      return (
        <>
          <p>
            {renderTappableText('Kot śpi.', {
              sentenceContext: 'Kot śpi.',
              onDailyLimitReached: handleDailyLimitReached,
            })}
          </p>
          <Page />
        </>
      );
    }
    renderInApp(
      <TranslationProvider>
        <FlashcardPage />
      </TranslationProvider>
    );

    tap(screen.getByText('Kot', { selector: '[data-word-index]' }));
    await elapse(0);
    expect(screen.getByRole('alert')).toHaveTextContent(`Daily limit reached until ${RESET_TIME}`);
    expect(storedUsage()).toEqual({ charsUsed: 1500, date: TODAY, resetTime: RESET_TIME });
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'OK' }));

    await openTranslator();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(RESET_TIME);
    expect(server.texts()).toEqual(['kot']);
  });

  test('admins are never blocked by the daily limit', async () => {
    localStorage.setItem(
      'translationUsage',
      JSON.stringify({ charsUsed: 5000, date: TODAY, resetTime: RESET_TIME })
    );
    renderTranslator({ isAdmin: true });

    await openTranslator();

    expect(dialog()).toBeInTheDocument();
  });
});

describe('closing the translator', () => {
  test('the close button clears the text, and a late answer does not appear on reopening', async () => {
    server.hold();
    renderTranslator();
    await openTranslator();
    type('cat');
    await pause();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'close' }));
    await elapse(500);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await server.answer('cat', 'kot');
    await openTranslator();

    expect(input()).toHaveValue('');
    expect(dialog()).toHaveTextContent('Translation will appear here');
    expect(dialog()).not.toHaveTextContent('kot');
  });

  test('the back button closes the translator', async () => {
    renderTranslator();
    await openTranslator();

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    await elapse(500);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('saving a translation', () => {
  async function translate(text: string, { polishToEnglish = false } = {}) {
    if (polishToEnglish) fireEvent.click(directionToggle());
    type(text);
    await pause();
  }

  const openSaveMenu = () =>
    fireEvent.click(within(dialog()).getByRole('button', { name: 'save translation' }));

  test('"Add to Vocabulary" after English→Polish puts the trimmed result as Polish and the input as English', async () => {
    const { openAddToVocabulary } = renderTranslator();
    await openTranslator();
    await translate('  Good morning ');

    openSaveMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Vocabulary' }));
    await elapse(500);

    expect(openAddToVocabulary).toHaveBeenCalledWith('Dzień dobry', 'Good morning');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('"Add to Sentences" after Polish→English puts the input as Polish and the result as English', async () => {
    const { openAddSentence, openAddToVocabulary } = renderTranslator();
    await openTranslator();
    await translate('Kot śpi.', { polishToEnglish: true });
    expect(server.requests()).toEqual([{ text: 'Kot śpi.', targetLang: 'EN' }]);

    openSaveMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Sentences' }));
    await elapse(500);

    expect(openAddSentence).toHaveBeenCalledWith({
      polish: 'Kot śpi.',
      english: 'The cat is sleeping.',
    });
    expect(openAddToVocabulary).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('only the save options available on the page are offered', async () => {
    renderTranslator({ sentences: false });
    await openTranslator();
    await translate('cat');

    openSaveMenu();

    expect(screen.getByRole('menuitem', { name: 'Add to Vocabulary' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Add to Sentences' })).not.toBeInTheDocument();
  });

  test('there is no save button where nothing can be saved', async () => {
    renderTranslator({ vocabulary: false, sentences: false });
    await openTranslator();
    await translate('cat');

    expect(dialog()).toHaveTextContent('kot');
    expect(
      within(dialog()).queryByRole('button', { name: 'save translation' })
    ).not.toBeInTheDocument();
  });

  test('"Copy" copies the translation and confirms', async () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    const { showSnackbar } = renderTranslator();
    await openTranslator();
    await translate('cat');

    fireEvent.click(within(dialog()).getByRole('button', { name: 'copy translation' }));
    await elapse(0);

    expect(clipboard.writeText).toHaveBeenCalledWith('kot');
    expect(showSnackbar).toHaveBeenCalledWith('Translation copied to clipboard', 'success');
  });

  test('a failed copy says so', async () => {
    const clipboard = stubClipboard(
      vi.fn(async () => {
        throw new Error('denied');
      })
    );
    cleanups.push(clipboard.restore);
    const { showSnackbar } = renderTranslator();
    await openTranslator();
    await translate('cat');

    fireEvent.click(within(dialog()).getByRole('button', { name: 'copy translation' }));
    await elapse(0);

    expect(showSnackbar).toHaveBeenCalledWith('Failed to copy translation', 'error');
  });
});
