import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { useDismissOnOutsideClick } from '../../src/hooks/useDismissOnOutsideClick';

let popup: HTMLElement;
let outside: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  popup = document.body.appendChild(document.createElement('div'));
  popup.appendChild(document.createElement('button'));
  outside = document.body.appendChild(document.createElement('p'));
});

afterEach(() => {
  popup.remove();
  outside.remove();
});

const insidePopup = (target: Node) => popup.contains(target);

interface Props {
  active: boolean;
  isInside: (target: Node) => boolean;
  onDismiss: (() => void) | undefined;
}

function renderDismiss(initial: Partial<Props> = {}) {
  const onDismiss = vi.fn();
  const props: Props = { active: true, isInside: insidePopup, onDismiss, ...initial };
  const hook = renderHook(
    (p: Props) => useDismissOnOutsideClick(p.active, p.isInside, p.onDismiss),
    { initialProps: props }
  );
  return {
    ...hook,
    onDismiss,
    /** Re-renders with some props changed, keeping the rest. */
    update: (changes: Partial<Props>) => hook.rerender({ ...props, ...changes }),
  };
}

/** Lets the deferred listeners attach. */
const nextTick = () => act(() => vi.advanceTimersByTime(0));

describe('useDismissOnOutsideClick', () => {
  test('a press outside dismisses once the listeners attach on the next tick', () => {
    const h = renderDismiss();
    nextTick();

    fireEvent.mouseDown(outside);

    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('the press that opened the element does not close it, the next one does', () => {
    const h = renderDismiss();

    // Same tick as opening: listeners are not attached yet.
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).not.toHaveBeenCalled();

    nextTick();
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('a press inside, even on a child element, does not dismiss', () => {
    const h = renderDismiss();
    nextTick();

    fireEvent.mouseDown(popup.querySelector('button')!);
    fireEvent.touchStart(popup);
    expect(h.onDismiss).not.toHaveBeenCalled();

    // The listeners are attached: a press outside still dismisses.
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('a touch outside dismisses on touch screens', () => {
    const h = renderDismiss();
    nextTick();

    fireEvent.touchStart(outside);

    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('does nothing while inactive, and starts listening once active', () => {
    const h = renderDismiss({ active: false });
    nextTick();
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).not.toHaveBeenCalled();

    h.update({ active: true });
    nextTick();
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('stops listening when it becomes inactive', () => {
    const h = renderDismiss();
    nextTick();
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);

    h.update({ active: false });
    nextTick();
    fireEvent.mouseDown(outside);
    fireEvent.touchStart(outside);

    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('stops listening on unmount', () => {
    const h = renderDismiss();
    nextTick();
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);

    h.unmount();
    fireEvent.mouseDown(outside);
    fireEvent.touchStart(outside);

    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('unmounting before the next tick cancels the pending listeners', () => {
    const h = renderDismiss();
    h.unmount();
    nextTick();

    fireEvent.mouseDown(outside);

    expect(h.onDismiss).not.toHaveBeenCalled();
  });

  test('uses the latest isInside, and stays listening while it changes', () => {
    const h = renderDismiss();
    nextTick();

    // The element grew to include the paragraph (e.g. a submenu opened there).
    h.update({ isInside: (target) => insidePopup(target) || target === outside });
    fireEvent.mouseDown(outside);
    expect(h.onDismiss).not.toHaveBeenCalled();

    // No tick needed: the listeners were not torn down and deferred again.
    fireEvent.mouseDown(document.body);
    expect(h.onDismiss).toHaveBeenCalledTimes(1);
  });

  test('calls the latest onDismiss, never an earlier one', () => {
    const h = renderDismiss();
    nextTick();
    const replacement = vi.fn();

    h.update({ onDismiss: replacement });
    nextTick();
    fireEvent.mouseDown(outside);

    expect(replacement).toHaveBeenCalledTimes(1);
    expect(h.onDismiss).not.toHaveBeenCalled();
  });

  test('without onDismiss, a press outside is checked and ignored without an error', () => {
    // An error thrown in a document listener does not reach fireEvent's caller; jsdom
    // reports it as a window error event instead.
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    const isInside = vi.fn(insidePopup);
    try {
      renderDismiss({ isInside, onDismiss: undefined });
      nextTick();

      fireEvent.mouseDown(outside);
    } finally {
      window.removeEventListener('error', onError);
    }

    expect(isInside).toHaveBeenCalledWith(outside);
    expect(errors).toEqual([]);
  });
});
