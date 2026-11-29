/**
 * Where translation UI appears on screen: word tooltips must not open under the
 * sticky app bar, and the translator must stay above the on-screen keyboard.
 * jsdom does no layout, so the boxes the code measures are stubbed per test.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderTappableText } from '../../src/lib/renderTappableText';
import { TranslatorModal } from '../../src/components/BottomMenu/TranslatorModal';
import { TranslationProvider, useTranslationContext } from '../../src/contexts/TranslationContext';

import { resetCallables } from './support/fakeFunctions';
import { fakeTranslateServer } from './support/translateServer';
import { renderInApp, settle, tap } from './support/app';

vi.mock('firebase/functions', () => import('./support/fakeFunctions'));

beforeEach(() => {
  resetCallables();
  fakeTranslateServer({ kot: 'cat' });
});

const VIEWPORT = { width: 400, height: 800 };
const TOOLTIP = { width: 120, height: 40 };

const rect = (x: number, y: number, width: number, height: number) =>
  ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height }) as DOMRect;

/** Lays out a 400x800 viewport with the tapped word `wordTop` px from its top. */
function layOut(wordTop: number) {
  const isWord = (el: Element) => el.hasAttribute('data-word-index');
  const isTooltip = (el: Element) => el.getAttribute('role') === 'tooltip';
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (isWord(this)) return rect(100, wordTop, 40, 20);
    if (isTooltip(this)) return rect(0, 0, TOOLTIP.width, TOOLTIP.height);
    if (this === document.documentElement) return rect(0, 0, VIEWPORT.width, VIEWPORT.height);
    return rect(0, 0, 0, 0);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return isTooltip(this) ? TOOLTIP.width : isWord(this) ? 40 : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return isTooltip(this) ? TOOLTIP.height : isWord(this) ? 20 : 0;
  });
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this === document.documentElement ? VIEWPORT.width : 0;
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return this === document.documentElement ? VIEWPORT.height : 0;
  });
}

async function tapKotAt(wordTop: number) {
  layOut(wordTop);
  renderInApp(<p>{renderTappableText('Kot', { sentenceContext: 'Kot' })}</p>);
  tap(screen.getByText('Kot', { selector: '[data-word-index]' }));
  await settle();
  await settle();
  return screen.getByRole('tooltip');
}

describe('where a word translation opens', () => {
  test('above the word when there is room below the app bar', async () => {
    const tooltip = await tapKotAt(400);

    expect(tooltip).toHaveTextContent('cat');
    expect(tooltip).toHaveAttribute('data-popper-placement', 'top');
  });

  test('below the word when opening above it would put it under the app bar', async () => {
    // Above the word the tooltip would span y=24..64, inside the 64px app bar.
    const tooltip = await tapKotAt(70);

    expect(tooltip).toHaveTextContent('cat');
    expect(tooltip).toHaveAttribute('data-popper-placement', 'bottom');
  });
});

function Page() {
  const { openTranslator } = useTranslationContext();
  return (
    <>
      <button onClick={openTranslator}>Open translator</button>
      <TranslatorModal />
    </>
  );
}

describe('the translator and the on-screen keyboard', () => {
  test('moves to the top of the screen while the keyboard is up, and back when it closes', async () => {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight });
    vi.stubGlobal('visualViewport', viewport);
    renderInApp(
      <TranslationProvider>
        <Page />
      </TranslationProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open translator' }));
    await settle();
    const container = () => document.querySelector('.MuiDialog-container')!;
    expect(getComputedStyle(container()).alignItems).toBe('center');

    viewport.height = window.innerHeight - 300;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(getComputedStyle(container()).alignItems).toBe('flex-start');

    viewport.height = window.innerHeight;
    act(() => {
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(getComputedStyle(container()).alignItems).toBe('center');
  });
});
