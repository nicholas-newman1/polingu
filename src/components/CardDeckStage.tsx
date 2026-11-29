import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Box, useTheme, type Theme } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { getRatingPalette } from '../lib/ratingColors';
import { BOTTOM_MENU_BAR_HEIGHT, HEADER_HEIGHT } from '../constants/layout';
import { CardDeckContext } from '../hooks/useCardDeck';
import type { CardCompletionOutcome } from '../hooks/useCardCompletion';
import { CardCompletionOverlay } from './CardCompletionOverlay';

const EXIT_DURATION_MS = 450;
const TOP_CLEARANCE_PX = HEADER_HEIGHT + 16;

const EXIT_ANIMATIONS: Record<CardCompletionOutcome, string> = {
  good: 'cardExitGood 420ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  easy: 'cardExitEasy 420ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  hard: 'cardExitHard 420ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  again: 'cardExitAgain 420ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  next: 'cardExitNext 420ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
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

const ExitingOverlayLayer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  userSelect: 'none',
  zIndex: theme.zIndex.appBar - 1,
}));

const ExitingSlot = styled(Box)({
  position: 'absolute',
  pointerEvents: 'none',
  userSelect: 'none',
});

function settleScrollForCard(wrapper: HTMLElement): void {
  // Always interrupt any smooth scroll started by revealing the previous card.
  window.scrollTo({ top: window.scrollY, behavior: 'instant' });

  const rect = wrapper.getBoundingClientRect();
  if (rect.top < TOP_CLEARANCE_PX) {
    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - TOP_CLEARANCE_PX),
      behavior: 'instant',
    });
    return;
  }

  if (window.scrollY > 0) {
    const docBottom = rect.bottom + window.scrollY;
    if (docBottom + BOTTOM_MENU_BAR_HEIGHT <= window.innerHeight) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }
}

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
  if (outcome !== 'next') {
    const tintOverlay = document.createElement('div');
    tintOverlay.setAttribute('aria-hidden', 'true');
    Object.assign(tintOverlay.style, {
      position: 'absolute',
      inset: '0',
      borderRadius: 'inherit',
      backgroundColor: alpha(glowColor, 0.18),
      pointerEvents: 'none',
      zIndex: '1',
    });
    clone.appendChild(tintOverlay);
  }
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

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren(clone);
    return () => {
      host.replaceChildren();
    };
  }, [clone]);

  return <ClonedCardSurface ref={hostRef} />;
}

function ExitingCardSlot({
  item,
  registerSlot,
}: {
  item: ExitingCard;
  registerSlot: (id: number, el: HTMLDivElement | null) => void;
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    el.style.top = `${item.top}px`;
    el.style.left = `${item.left}px`;
    registerSlot(item.id, el);
    return () => {
      registerSlot(item.id, null);
    };
  }, [item.id, item.top, item.left, registerSlot]);

  return (
    <ExitingSlot ref={slotRef} style={{ width: item.width, height: item.height }}>
      <ClonedCardHost clone={item.clone} />
      <CardCompletionOverlay outcome={item.outcome} />
    </ExitingSlot>
  );
}

export function CardDeckStage({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nextIdRef = useRef(1);
  const pendingAlignIdRef = useRef<number | null>(null);
  const slotElsRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const timersRef = useRef<Set<number>>(new Set());
  const [transitionId, setTransitionId] = useState(0);
  const [exitingCards, setExitingCards] = useState<ExitingCard[]>([]);

  const registerSlot = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) {
      slotElsRef.current.set(id, el);
    } else {
      slotElsRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // Runs synchronously after the new card commits and before first paint, so scroll
  // settles and the exiting clone aligns cleanly over the incoming card with zero jump.
  useLayoutEffect(() => {
    const alignId = pendingAlignIdRef.current;
    if (alignId === null) return;
    pendingAlignIdRef.current = null;

    const wrapper = containerRef.current?.querySelector<HTMLElement>('[data-card-wrapper]');
    if (!wrapper) {
      window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      return;
    }

    settleScrollForCard(wrapper);

    const alignedRect = wrapper.getBoundingClientRect();
    const slotEl = slotElsRef.current.get(alignId);
    if (slotEl) {
      slotEl.style.top = `${alignedRect.top}px`;
      slotEl.style.left = `${alignedRect.left}px`;
    }
  }, [transitionId]);

  const launchExit = useCallback(
    (surfaceEl: HTMLElement | null, outcome: CardCompletionOutcome) => {
      if (!surfaceEl) return;

      const surfaceRect = surfaceEl.getBoundingClientRect();
      const clone = prepareExitingClone(surfaceEl, outcome, theme);
      const id = nextIdRef.current++;
      pendingAlignIdRef.current = id;

      setTransitionId((n) => n + 1);
      setExitingCards((prev) => [
        ...prev,
        {
          id,
          outcome,
          clone,
          top: surfaceRect.top,
          left: surfaceRect.left,
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

  const overlay =
    exitingCards.length > 0
      ? createPortal(
          <ExitingOverlayLayer aria-hidden="true">
            {exitingCards.map((item) => (
              <ExitingCardSlot key={item.id} item={item} registerSlot={registerSlot} />
            ))}
          </ExitingOverlayLayer>,
          document.body
        )
      : null;

  return (
    <CardDeckContext.Provider value={value}>
      <DeckContainer ref={containerRef}>{children}</DeckContainer>
      {overlay}
    </CardDeckContext.Provider>
  );
}
