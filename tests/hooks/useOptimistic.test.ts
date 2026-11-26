import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useOptimistic } from '../../src/hooks/useOptimistic';
import { deferred } from './support/deferred';

/**
 * Renders useOptimistic under a parent that owns the committed value, like the
 * pages do: each save commits its value to the parent once it succeeds.
 */
function renderOptimistic(initial: string[]) {
  const onError = vi.fn();
  const options = { onError };
  const hook = renderHook(({ committed }) => useOptimistic(committed, options), {
    initialProps: { committed: initial },
  });
  const commit = (committed: string[]) => hook.rerender({ committed });

  /** Applies `value` optimistically; the returned handle finishes its save. */
  const save = (value: string[]) => {
    const pending = deferred();
    act(() =>
      hook.result.current[1](value, async () => {
        await pending.promise;
        commit(value);
      })
    );
    return {
      succeed: () => act(async () => pending.resolve()),
      fail: (error = new Error('offline')) => act(async () => pending.reject(error)),
    };
  };

  return { value: () => hook.result.current[0], save, commit, onError };
}

describe('useOptimistic', () => {
  test('shows the new value at once, while the save is still in flight', () => {
    const h = renderOptimistic(['kot']);
    h.save(['kot', 'pies']);
    expect(h.value()).toEqual(['kot', 'pies']);
  });

  test('after the save succeeds, shows the committed value', async () => {
    const h = renderOptimistic(['kot']);
    await h.save(['kot', 'pies']).succeed();
    expect(h.value()).toEqual(['kot', 'pies']);
    expect(h.onError).not.toHaveBeenCalled();
  });

  test('a failed save rolls back to the value before the change and reports the error', async () => {
    vi.useFakeTimers();
    const h = renderOptimistic(['kot']);
    const error = new Error('permission denied');
    await h.save(['kot', 'pies']).fail(error);

    expect(h.value()).toEqual(['kot']);
    expect(h.onError).toHaveBeenCalledExactlyOnceWith(error);
    act(() => vi.runAllTimers());
    expect(h.value()).toEqual(['kot']);
  });

  test('an earlier save finishing late does not replace a newer change', async () => {
    const h = renderOptimistic(['kot']);
    const first = h.save(['kot', 'pies']);
    h.save(['kot', 'pies', 'ryba']);

    await first.fail();
    expect(h.value()).toEqual(['kot', 'pies', 'ryba']);
    expect(h.onError).not.toHaveBeenCalled();
  });

  test('when the newer of two saves fails, the value returns to the last committed one', async () => {
    vi.useFakeTimers();
    const h = renderOptimistic(['kot']);
    const first = h.save(['kot', 'pies']);
    const second = h.save(['kot', 'pies', 'ryba']);

    await first.succeed();
    expect(h.value()).toEqual(['kot', 'pies', 'ryba']);
    await second.fail();
    act(() => vi.runAllTimers());

    expect(h.value()).toEqual(['kot', 'pies']);
    expect(h.onError).toHaveBeenCalledTimes(1);
  });

  test('an outside change to the committed value shows once no save is pending', () => {
    const h = renderOptimistic(['kot']);
    h.commit(['kot', 'kaczka']);
    expect(h.value()).toEqual(['kot', 'kaczka']);
  });
});
