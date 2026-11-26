import { beforeEach, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../../src/hooks/useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

const render = (value: string, delay = 300) =>
  renderHook((props) => useDebouncedValue(props.value, props.delay), {
    initialProps: { value, delay },
  });

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

test('returns the first value straight away', () => {
  expect(render('kot').result.current).toBe('kot');
});

test('a change shows up only once the delay has passed', () => {
  const { result, rerender } = render('kot');
  rerender({ value: 'pies', delay: 300 });
  advance(299);
  expect(result.current).toBe('kot');
  advance(1);
  expect(result.current).toBe('pies');
});

test('a burst of changes lands only the last value, a full delay after it', () => {
  const { result, rerender } = render('');
  for (const value of ['k', 'ko', 'kot']) {
    rerender({ value, delay: 300 });
    advance(200);
  }
  expect(result.current).toBe('');
  advance(99);
  expect(result.current).toBe('');
  advance(1);
  expect(result.current).toBe('kot');
});

test('changing the delay restarts the wait with the new delay', () => {
  const { result, rerender } = render('kot');
  rerender({ value: 'pies', delay: 300 });
  advance(200);
  rerender({ value: 'pies', delay: 50 });
  advance(49);
  expect(result.current).toBe('kot');
  advance(1);
  expect(result.current).toBe('pies');
});

test('unmounting cancels a pending update', () => {
  const { rerender, unmount } = render('kot');
  rerender({ value: 'pies', delay: 300 });
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
