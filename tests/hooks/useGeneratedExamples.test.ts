import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  generateExample,
  type GenerateExampleResponse,
  type GeneratedExample,
} from '../../src/lib/generateExample';
import { useGeneratedExamples } from '../../src/hooks/useGeneratedExamples';
import { deferred } from './support/deferred';

// generateExample calls a Cloud Function.
vi.mock('../../src/lib/generateExample', () => ({ generateExample: vi.fn() }));

const ERROR = 'Failed to generate. Please try again.';
const example = (polish: string): GeneratedExample => ({ polish, english: `en ${polish}` });
const request = (polish: string) => ({ polish, english: `en ${polish}` });

/** Each call to generateExample waits for the test to answer it. */
function pendingRequests() {
  const calls: Array<ReturnType<typeof deferred<GenerateExampleResponse>>> = [];
  vi.mocked(generateExample).mockImplementation(() => {
    const call = deferred<GenerateExampleResponse>();
    calls.push(call);
    return call.promise;
  });
  return {
    answer: (index: number, ...polish: string[]) =>
      act(async () => calls[index].resolve({ examples: polish.map(example) })),
    fail: (index: number) => act(async () => calls[index].reject(new Error('quota'))),
  };
}

function renderExamples(limit?: number) {
  const hook = renderHook(() => useGeneratedExamples({ errorMessage: ERROR, limit }));
  const state = () => hook.result.current;
  return {
    state,
    generate: (polish: string) => act(() => void state().generate(request(polish))),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useGeneratedExamples', () => {
  test('shows progress, then lists the examples up to the limit, all selected', async () => {
    const requests = pendingRequests();
    const h = renderExamples(2);

    h.generate('kot');
    expect(h.state().isGenerating).toBe(true);
    expect(generateExample).toHaveBeenCalledWith(request('kot'));

    await requests.answer(0, 'Mam kota.', 'Kot śpi.', 'Kot je.');
    expect(h.state().isGenerating).toBe(false);
    expect(h.state().items).toEqual([example('Mam kota.'), example('Kot śpi.')]);
    expect(h.state().selectedItems).toEqual(h.state().items);
  });

  test('a failure shows the error message and no examples', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    await requests.fail(0);

    expect(h.state()).toMatchObject({ isGenerating: false, error: ERROR, items: [] });
  });

  test('generating again clears the previous examples and error first', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    await requests.fail(0);
    h.generate('kot');

    expect(h.state()).toMatchObject({ isGenerating: true, error: null, items: [] });
    await requests.answer(1, 'Mam kota.');
    expect(h.state().items).toEqual([example('Mam kota.')]);
  });

  test('reset clears examples, error and progress', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    await requests.answer(0, 'Mam kota.');
    act(() => h.state().reset());
    expect(h.state()).toMatchObject({ isGenerating: false, error: null, items: [] });
  });

  test('examples from an earlier request that finishes last do not replace newer ones', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    act(() => h.state().reset());
    h.generate('pies');

    await requests.answer(1, 'Mam psa.');
    await requests.answer(0, 'Mam kota.');

    expect(h.state().items).toEqual([example('Mam psa.')]);
  });

  test('an earlier request that finishes first leaves the newer one in progress', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    h.generate('pies');

    await requests.fail(0);
    expect(h.state()).toMatchObject({ isGenerating: true, error: null, items: [] });

    await requests.answer(1, 'Mam psa.');
    expect(h.state()).toMatchObject({ isGenerating: false, items: [example('Mam psa.')] });
  });

  test('reset discards a request that is still running', async () => {
    const requests = pendingRequests();
    const h = renderExamples();
    h.generate('kot');
    act(() => h.state().reset());

    await requests.answer(0, 'Mam kota.');
    expect(h.state()).toMatchObject({ isGenerating: false, error: null, items: [] });
  });
});
