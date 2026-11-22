import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, useTheme, type Theme } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { getRatingPalette } from '../lib/ratingColors';
import { CardDeckContext } from '../hooks/useCardDeck';
import type { CardCompletionOutcome } from '../hooks/useCardCompletion';
import { CardCompletionOverlay } from './CardCompletionOverlay';

const EXIT_DURATION_MS = 330;

const EXIT_ANIMATIONS: Record<CardCompletionOutcome, string> = {
  good: 'cardExitGood 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  easy: 'cardExitEasy 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  hard: 'cardExitHard 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  again: 'cardExitAgain 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  next: 'cardExitNext 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
};

function getExitGlowColor(theme: Theme, outcome: CardCompletionOutcome): string {
  return outcome === 'next' ? theme.palette.text.primary : getRatingPalette(theme, outcome).main;
}

interface ExitingCard {
  id: number;
  outcome: CardCompletionOutcome;
  clone: HTMLElement;
  top: number;
  left: number;
  width: number;
  height: number;
}

const DeckContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const ExitingSlot = styled(Box)({
  position: 'absolute',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: 10,
});

function prepareExitingClone(
  surfaceEl: HTMLElement,
  outcome: CardCompletionOutcome,
  theme: Theme
): HTMLElement {
  const clone = surfaceEl.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

  const glowColor = getExitGlowColor(theme, outcome);
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.willChange = 'transform, opacity';
  clone.style.borderColor = alpha(glowColor, 0.75);
  clone.style.boxShadow = `0 0 0 2px ${alpha(glowColor, 0.7)}, 0 14px 38px ${alpha(glowColor, 0.42)}`;
  clone.style.animation = EXIT_ANIMATIONS[outcome];
  return clone;
}

const ClonedCardSurface = styled(Box)({
  width: '100%',
  height: '100%',
  '& > * *': {
    animation: 'none !important',
    transition: 'none !important',
  },
});

function ClonedCardHost({ clone }: { clone: HTMLElement }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren(clone);
    return () => {
      host.replaceChildren();
    };
  }, [clone]);

  return <ClonedCardSurface ref={hostRef} />;
}

export function CardDeckStage({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Set<number>>(new Set());
  const [transitionId, setTransitionId] = useState(0);
  const [exitingCards, setExitingCards] = useState<ExitingCard[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const launchExit = useCallback(
    (surfaceEl: HTMLElement | null, outcome: CardCompletionOutcome) => {
      const container = containerRef.current;
      if (!surfaceEl || !container) return;

      const containerRect = container.getBoundingClientRect();
      const surfaceRect = surfaceEl.getBoundingClientRect();
      const clone = prepareExitingClone(surfaceEl, outcome, theme);
      const id = nextIdRef.current++;

      setTransitionId((n) => n + 1);
      setExitingCards((prev) => [
        ...prev,
        {
          id,
          outcome,
          clone,
          top: surfaceRect.top - containerRect.top,
          left: surfaceRect.left - containerRect.left,
          width: surfaceRect.width,
          height: surfaceRect.height,
        },
      ]);

      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        setExitingCards((prev) => prev.filter((item) => item.id !== id));
      }, EXIT_DURATION_MS);
      timersRef.current.add(timer);
    },
    [theme]
  );

  const value = useMemo(() => ({ transitionId, launchExit }), [transitionId, launchExit]);

  return (
    <CardDeckContext.Provider value={value}>
      <DeckContainer ref={containerRef}>
        {children}
        {exitingCards.map((item) => (
          <ExitingSlot
            key={item.id}
            aria-hidden="true"
            sx={{
              top: item.top,
              left: item.left,
              width: item.width,
              height: item.height,
            }}
          >
            <ClonedCardHost clone={item.clone} />
            <CardCompletionOverlay outcome={item.outcome} />
          </ExitingSlot>
        ))}
      </DeckContainer>
    </CardDeckContext.Provider>
  );
}
