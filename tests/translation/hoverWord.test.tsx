/**
 * Desktop hover translations on flashcard sentences, and the hover-or-click tooltip
 * behaviour behind them. Only the Cloud Function is faked.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, renderHook, screen, within } from '@testing-library/react';
import { renderTappableText } from '../../src/lib/renderTappableText';
import { useTooltipInteraction } from '../../src/components/shared';
import { resetCallables } from './support/fakeFunctions';
import {
  dailyLimitError,
  fakeTranslateServer,
  minuteLimitError,
  resetTimeIn,
  type FakeTranslateServer,
} from './support/translateServer';
import { limitDialog, renderInApp, settle, stubClipboard, tap } from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

const SENTENCE = 'Kot pije mleko.';

let server: FakeTranslateServer;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  resetCallables();
  server = fakeTranslateServer({ kot: 'cat', pije: 'drinks', mleko: 'milk', pies: 'dog' });
});

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

type Options = Parameters<typeof renderTappableText>[1];

const sentence = (text: string, options: Partial<Options> = {}) => (
  <p>{renderTappableText(text, { sentenceContext: text, sentenceId: 's-1', ...options })}</p>
);

const word = (text: string) => screen.getByText(text, { selector: '[data-word-index]' });
const tooltip = () => screen.getByRole('tooltip');
const tooltips = () => screen.queryAllByRole('tooltip');

describe('hovering a word in a sentence', () => {
  test('shows its translation while the pointer is over it', async () => {
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('mleko.'));
    await settle();
    expect(tooltip()).toHaveTextContent('milk');
    expect(server.requests()).toEqual([
      { text: 'mleko', targetLang: 'EN', context: SENTENCE, sentenceId: 's-1' },
    ]);

    fireEvent.mouseLeave(word('mleko.'));
    await settle();
    expect(tooltips()).toHaveLength(0);
  });

  test('shows a spinner until the translation arrives', async () => {
    server.hold();
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();
    expect(within(tooltip()).getByRole('progressbar')).toBeInTheDocument();

    await server.answer('kot', 'cat');
    expect(tooltip()).toHaveTextContent('cat');
  });

  test('hovering the same word again reuses its translation', async () => {
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();
    fireEvent.mouseLeave(word('Kot'));
    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('cat');
    expect(server.texts()).toEqual(['kot']);
  });

  test('moving on while a lookup is in flight does not start a second lookup for it', async () => {
    server.hold();
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    fireEvent.mouseLeave(word('Kot'));
    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(server.texts()).toEqual(['kot']);
  });

  test("a word in the sentence's cache is shown without calling the server", async () => {
    renderInApp(sentence(SENTENCE, { translations: { pije: 'drinks (saved)' } }));

    fireEvent.mouseEnter(word('pije'));
    await settle();

    expect(tooltip()).toHaveTextContent('drinks (saved)');
    expect(server.requests()).toEqual([]);
  });

  test('hovering a token that is only punctuation looks nothing up', async () => {
    renderInApp(sentence('Kot ? pije'));

    fireEvent.mouseEnter(word('?'));
    await settle();

    expect(server.requests()).toEqual([]);
  });

  test('a failed lookup says "Translation failed"', async () => {
    server.failWith(new Error('offline'));
    const { showSnackbar } = renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('Translation failed');
    expect(showSnackbar).toHaveBeenCalledWith('Translation failed. Please try again.', 'error');
  });

  test('a per-minute rate limit says "Too many requests"', async () => {
    server.failWith(minuteLimitError());
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(tooltip()).toHaveTextContent('Too many requests');
  });

  test('reaching the daily limit says when the limit resets', async () => {
    server.failWith(dailyLimitError(resetTimeIn(150)));
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(limitDialog()).toHaveTextContent('Your limit will reset in 2 hours 30 minutes');
  });

  test('"Add to vocabulary" in the hover tooltip hands over the word and its translation', async () => {
    const { openAddToVocabulary } = renderInApp(sentence(SENTENCE));
    fireEvent.mouseEnter(word('mleko.'));
    await settle();

    fireEvent.click(within(tooltip()).getByRole('button', { name: 'Add to vocabulary' }));
    await settle();

    expect(openAddToVocabulary).toHaveBeenCalledWith('mleko.', 'milk');
    expect(tooltips()).toHaveLength(0);
  });

  test('"Copy" in the hover tooltip copies the word', async () => {
    const clipboard = stubClipboard();
    cleanups.push(clipboard.restore);
    const { showSnackbar } = renderInApp(sentence(SENTENCE));
    fireEvent.mouseEnter(word('Kot'));
    await settle();

    fireEvent.click(within(tooltip()).getByRole('button', { name: 'Copy to clipboard' }));
    await settle();

    expect(clipboard.writeText).toHaveBeenCalledWith('Kot');
    expect(showSnackbar).toHaveBeenCalledWith('Copied to clipboard', 'success');
  });

  test('clicking a hovered word does not open a second tooltip or look it up again', async () => {
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();

    expect(tooltips()).toHaveLength(1);
    expect(server.texts()).toEqual(['kot']);
  });

  test('clicking a word whose hover lookup is still in flight waits for it instead of asking again', async () => {
    server.hold();
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();
    await server.answer('kot', 'cat');

    expect(tooltips()).toHaveLength(1);
    expect(tooltip()).toHaveTextContent('cat');
    expect(server.texts()).toEqual(['kot']);
  });

  test('moving off and back onto a tapped word does not open a hover tooltip over it', async () => {
    renderInApp(sentence(SENTENCE));

    fireEvent.mouseEnter(word('Kot'));
    await settle();
    tap(word('Kot'));
    await settle();
    fireEvent.mouseLeave(word('Kot'));
    fireEvent.mouseEnter(word('Kot'));
    await settle();

    expect(tooltips()).toHaveLength(1);
    expect(tooltip()).toHaveTextContent('cat');
  });

  test('after the sentence text changes, hovering shows the new word’s translation', async () => {
    const view = renderInApp(sentence('Kot pije mleko.'));
    fireEvent.mouseEnter(word('Kot'));
    await settle();
    fireEvent.mouseLeave(word('Kot'));

    view.rerender(sentence('Pies pije mleko.'));
    fireEvent.mouseEnter(word('Pies'));
    await settle();

    expect(tooltip()).toHaveTextContent('dog');
  });
});

describe('useTooltipInteraction', () => {
  test('a click toggles the tooltip open on the clicked element, and an outside press closes it', () => {
    const anchor = document.createElement('span');
    const popper = document.createElement('div');
    document.body.append(anchor, popper);
    cleanups.push(() => {
      anchor.remove();
      popper.remove();
    });
    const { result } = renderHook(() => useTooltipInteraction());
    result.current.popperRef.current = popper;

    act(() => result.current.handleClick({ currentTarget: anchor } as never));
    expect(result.current.open).toBe(true);
    expect(result.current.anchorEl).toBe(anchor);

    fireEvent.mouseDown(popper);
    fireEvent.mouseDown(anchor);
    expect(result.current.open).toBe(true);

    fireEvent.mouseDown(document.body);
    expect(result.current.open).toBe(false);

    act(() => result.current.handleClick({ currentTarget: anchor } as never));
    act(() => result.current.handleClick({ currentTarget: anchor } as never));
    expect(result.current.open).toBe(false);
  });

  test('close() hides a tooltip that is open by hover and by click', () => {
    const anchor = document.createElement('span');
    const { result } = renderHook(() => useTooltipInteraction());

    act(() => result.current.handleMouseEnter({ currentTarget: anchor } as never));
    act(() => result.current.handleClick({ currentTarget: anchor } as never));
    expect(result.current.open).toBe(true);

    act(() => result.current.close());
    expect(result.current.open).toBe(false);
  });
});
