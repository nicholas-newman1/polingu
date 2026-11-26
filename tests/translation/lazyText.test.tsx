/**
 * Lazy rendering of long translatable text: placeholders hold the scroll height of
 * paragraphs that have not been rendered yet, and a paragraph renders once it comes
 * near the viewport and then stays rendered.
 */
import { describe, expect, test, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { estimatePlaceholderHeight } from '../../src/components/lazyText/textSizing';
import { useLazyVisibility } from '../../src/components/lazyText/useLazyVisibility';

describe('estimatePlaceholderHeight', () => {
  test('an empty paragraph still reserves one line', () => {
    expect(estimatePlaceholderHeight(0, 'medium')).toBe(estimatePlaceholderHeight(1, 'medium'));
    expect(estimatePlaceholderHeight(0, 'medium')).toBeGreaterThan(0);
  });

  test('a paragraph that wraps onto more lines reserves proportionally more height', () => {
    const oneLine = estimatePlaceholderHeight(10, 'medium');
    const twoLines = estimatePlaceholderHeight(11, 'medium');
    const threeLines = estimatePlaceholderHeight(30, 'medium');

    expect(estimatePlaceholderHeight(10, 'medium')).toBe(oneLine);
    expect(twoLines).toBeGreaterThan(oneLine);
    expect(threeLines).toBeGreaterThan(twoLines);
    expect(Math.abs(threeLines - 3 * oneLine)).toBeLessThanOrEqual(2);
  });

  test('a larger font reserves more height for the same words', () => {
    const words = 40;
    const small = estimatePlaceholderHeight(words, 'small');
    const medium = estimatePlaceholderHeight(words, 'medium');
    const large = estimatePlaceholderHeight(words, 'large');

    expect(medium).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(medium);
  });

  test('heights are whole pixels', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      for (const words of [0, 7, 13, 99]) {
        expect(Number.isInteger(estimatePlaceholderHeight(words, size))).toBe(true);
      }
    }
  });
});

/** A fake IntersectionObserver (missing in jsdom) whose entries the test reports. */
function installIntersectionObserver() {
  const observers: FakeObserver[] = [];
  class FakeObserver {
    readonly observed: Element[] = [];
    readonly callback: IntersectionObserverCallback;
    readonly options: IntersectionObserverInit;
    disconnected = false;
    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.callback = callback;
      this.options = options;
      observers.push(this);
    }
    observe(el: Element) {
      this.observed.push(el);
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
    takeRecords() {
      return [];
    }
    report(isIntersecting: boolean) {
      act(() =>
        this.callback(
          this.observed.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry),
          this as unknown as IntersectionObserver
        )
      );
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  return observers;
}

interface RowProps {
  index: number;
  initiallyVisible?: boolean;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
}

function LazyRow({ index, initiallyVisible = false, registerRef }: RowProps) {
  const { hasBeenVisible, setPlaceholder } = useLazyVisibility({
    initiallyVisible,
    rootMargin: '400px 0px',
    index,
    registerRef,
  });
  return (
    <div ref={setPlaceholder} data-testid={`row-${index}`}>
      {hasBeenVisible ? <p>Paragraph {index}</p> : null}
    </div>
  );
}

describe('useLazyVisibility', () => {
  test('a row near the viewport renders, and keeps rendering after it scrolls away', () => {
    const observers = installIntersectionObserver();
    render(<LazyRow index={3} registerRef={() => {}} />);
    expect(screen.queryByText('Paragraph 3')).not.toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(observers[0].options.rootMargin).toBe('400px 0px');
    expect(observers[0].observed).toEqual([screen.getByTestId('row-3')]);

    observers[0].report(false);
    expect(screen.queryByText('Paragraph 3')).not.toBeInTheDocument();

    observers[0].report(true);
    expect(screen.getByText('Paragraph 3')).toBeInTheDocument();
    expect(observers[0].disconnected).toBe(true);
  });

  test('a row that starts visible renders at once without watching the viewport', () => {
    const observers = installIntersectionObserver();
    render(<LazyRow index={0} initiallyVisible registerRef={() => {}} />);

    expect(screen.getByText('Paragraph 0')).toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  test('the row element is registered under its index, and unregistered on unmount', () => {
    installIntersectionObserver();
    const registerRef = vi.fn();
    const { unmount } = render(<LazyRow index={5} registerRef={registerRef} />);

    expect(registerRef).toHaveBeenCalledWith(5, screen.getByTestId('row-5'));

    unmount();
    expect(registerRef).toHaveBeenLastCalledWith(5, null);
  });
});
