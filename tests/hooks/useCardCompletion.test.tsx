import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Rating, type Grade } from 'ts-fsrs';
import { AppSettingsProvider } from '../../src/contexts/AppSettingsContext';
import {
  CardDeckContext,
  useCardDeck,
  type CardDeckContextValue,
} from '../../src/hooks/useCardDeck';
import { ratingToCompletionOutcome, useCardCompletion } from '../../src/hooks/useCardCompletion';
import { playCardChime } from '../../src/lib/cardFeedback';
import loadAppSettings from '../../src/lib/storage/loadAppSettings';
import { DEFAULT_APP_SETTINGS } from '../../src/types/appSettings';
import { withAuth } from './support/providers';

// Settings come from storage; the chime is Web Audio. Both are boundaries here.
vi.mock('../../src/lib/storage/loadAppSettings', () => ({ default: vi.fn() }));
vi.mock('../../src/lib/storage/saveAppSettings', () => ({ default: vi.fn() }));
vi.mock('../../src/lib/cardFeedback', () => ({ playCardChime: vi.fn() }));

let reducedMotion = false;

beforeEach(() => {
  vi.resetAllMocks();
  reducedMotion = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' && reducedMotion,
    media: query,
  }));
});

interface Setup {
  autoPlayAudio?: boolean;
  deck?: CardDeckContextValue | null;
}

async function renderCompletion({ autoPlayAudio = false, deck = null }: Setup = {}) {
  vi.mocked(loadAppSettings).mockResolvedValue({ ...DEFAULT_APP_SETTINGS, autoPlayAudio });
  const auth = withAuth('learner');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <auth.wrapper>
      <AppSettingsProvider>
        <CardDeckContext.Provider value={deck}>{children}</CardDeckContext.Provider>
      </AppSettingsProvider>
    </auth.wrapper>
  );
  const hook = renderHook(() => useCardCompletion(), { wrapper });
  await act(async () => {}); // settings load
  return hook;
}

const makeDeck = (transitionId = 0): CardDeckContextValue => ({
  transitionId,
  launchExit: vi.fn(),
});

/** Points the card's surface ref at a real element, as the card component does. */
function mountSurface(result: { current: ReturnType<typeof useCardCompletion> }) {
  const surface = document.createElement('div');
  result.current.surfaceRef.current = surface;
  return surface;
}

describe('useCardCompletion', () => {
  test('a double tap completes the card only once', async () => {
    const { result } = await renderCompletion();
    const onComplete = vi.fn();

    act(() => {
      result.current.trigger('good', onComplete);
      result.current.trigger('again', onComplete);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('launches the exit animation from the card surface with the outcome, then completes', async () => {
    const deck = makeDeck();
    const { result } = await renderCompletion({ deck });
    const surface = mountSurface(result);
    const order: string[] = [];
    vi.mocked(deck.launchExit).mockImplementation(() => void order.push('exit'));

    act(() => result.current.trigger('hard', () => order.push('complete')));

    expect(deck.launchExit).toHaveBeenCalledExactlyOnceWith(surface, 'hard');
    expect(order).toEqual(['exit', 'complete']);
  });

  test('skips the exit animation when the user prefers reduced motion, but still completes', async () => {
    reducedMotion = true;
    const deck = makeDeck();
    const { result } = await renderCompletion({ deck });
    mountSurface(result);
    const onComplete = vi.fn();

    act(() => result.current.trigger('good', onComplete));
    expect(deck.launchExit).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('completes without animating outside a card deck or before the surface mounts', async () => {
    const outside = await renderCompletion();
    mountSurface(outside.result);
    const onComplete = vi.fn();
    act(() => outside.result.current.trigger('good', onComplete));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(outside.result.current.promoted).toBe(false);

    const deck = makeDeck();
    const unmounted = await renderCompletion({ deck });
    act(() => unmounted.result.current.trigger('easy', onComplete));
    expect(deck.launchExit).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  test('plays the outcome chime only when audio auto-play is on', async () => {
    const quiet = await renderCompletion({ autoPlayAudio: false });
    act(() => quiet.result.current.trigger('good', () => {}));
    expect(playCardChime).not.toHaveBeenCalled();

    const loud = await renderCompletion({ autoPlayAudio: true });
    act(() => loud.result.current.trigger('again', () => {}));
    expect(playCardChime).toHaveBeenCalledExactlyOnceWith('again');
  });

  test('a card is promoted once an earlier card has exited the deck', async () => {
    const first = await renderCompletion({ deck: makeDeck(0) });
    expect(first.result.current.promoted).toBe(false);
    const later = await renderCompletion({ deck: makeDeck(3) });
    expect(later.result.current.promoted).toBe(true);
  });

  test('each rating maps to its own completion outcome', () => {
    const ratings: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
    expect(ratings.map((rating) => ratingToCompletionOutcome(rating))).toEqual([
      'again',
      'hard',
      'good',
      'easy',
    ]);
  });
});

test('useCardDeck is null outside a card deck', () => {
  expect(renderHook(() => useCardDeck()).result.current).toBeNull();
});
