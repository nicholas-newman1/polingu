import {
  createContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  startTransition,
  memo,
  type ReactNode,
} from 'react';

interface ActiveWordState {
  index: number;
  word: string;
  anchorEl: HTMLElement;
  sentenceContext?: string;
  declensionCardId?: number;
  sentenceId?: string;
}

interface TranslatableTextActionsContextValue {
  startDrag: (index: number, element: HTMLElement) => void;
  updateDrag: (index: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  registerWord: (index: number, word: string) => void;
  closePhraseTooltip: () => void;
  handleWordClick: (word: ActiveWordState) => void;
  closeWordTooltip: () => void;
  subscribeSelection: (callback: () => void) => () => void;
  isIndexSelected: (index: number) => boolean;
  getSelectedIndices: () => number[];
  subscribeInteractionState: (callback: () => void) => () => void;
  getInteractionState: () => { isDragging: boolean; hasPhrase: boolean };
}

interface TranslatableTextUIContextValue {
  activeWord: ActiveWordState | null;
  phraseAnchorEl: HTMLElement | null;
  selectedPhrase: string | null;
}

// eslint-disable-next-line react-refresh/only-export-components
export const TranslatableTextActionsContext =
  createContext<TranslatableTextActionsContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const TranslatableTextUIContext = createContext<TranslatableTextUIContextValue | null>(null);

interface TranslatableTextProviderProps {
  children: React.ReactNode;
  overlays?: React.ReactNode;
  onTranslatePhrase?: (phrase: string) => void;
  onWordTap?: () => void;
}

const MemoizedChildTree = memo(function MemoizedChildTree({ children }: { children: ReactNode }) {
  return children;
});

function getRange(start: number | null, end: number | null): [number, number] | null {
  if (start === null || end === null) return null;
  return [Math.min(start, end), Math.max(start, end)];
}

/** Joins the registered words in [min, max], collapsing a word repeated at consecutive indices. */
function buildPhrase(words: Map<number, string>, [min, max]: [number, number]): string {
  const phrase: string[] = [];
  let lastAddedIndex: number | null = null;
  for (let i = min; i <= max; i++) {
    const word = words.get(i);
    if (!word) continue;
    if (lastAddedIndex === i - 1 && word === phrase[phrase.length - 1]) continue;
    phrase.push(word);
    lastAddedIndex = i;
  }
  return phrase.join(' ');
}

function wordIndexAtTouch(e: TouchEvent): number | null {
  const touch = e.touches[0];
  if (!touch) return null;
  const attr = document
    .elementFromPoint(touch.clientX, touch.clientY)
    ?.getAttribute('data-word-index');
  if (attr == null) return null;
  const index = parseInt(attr, 10);
  return isNaN(index) ? null : index;
}

/** Tracks a drag that leaves the word elements; returns the cleanup. */
function addDocumentDragListeners(onUpdate: (index: number) => void, onEnd: () => void) {
  const handleMouseLeave = (e: MouseEvent) => {
    if (e.target === document.documentElement) onEnd();
  };
  const handleTouchMove = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    const index = wordIndexAtTouch(e);
    if (index !== null) onUpdate(index);
  };

  document.addEventListener('mouseup', onEnd);
  document.addEventListener('mouseleave', handleMouseLeave);
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchmove', handleTouchMove, { passive: false });

  return () => {
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('mouseleave', handleMouseLeave);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchmove', handleTouchMove);
  };
}

export function TranslatableTextProvider({
  children,
  overlays,
  onTranslatePhrase,
  onWordTap,
}: TranslatableTextProviderProps) {
  const [phraseAnchorEl, setPhraseAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedPhrase, setSelectedPhraseState] = useState<string | null>(null);
  const [activeWord, setActiveWord] = useState<ActiveWordState | null>(null);

  const wordsRef = useRef<Map<number, string>>(new Map());
  const activeWordRef = useRef<ActiveWordState | null>(null);
  const dragStartElementRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);
  const selectedPhraseRef = useRef<string | null>(null);
  const subscribersRef = useRef<Set<() => void>>(new Set());
  const interactionSubscribersRef = useRef<Set<() => void>>(new Set());
  const documentListenersCleanupRef = useRef<(() => void) | null>(null);
  const updateDragRef = useRef<((index: number) => void) | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  const onTranslatePhraseRef = useRef(onTranslatePhrase);
  const onWordTapRef = useRef(onWordTap);

  useEffect(() => {
    activeWordRef.current = activeWord;
  }, [activeWord]);

  useEffect(() => {
    onTranslatePhraseRef.current = onTranslatePhrase;
  }, [onTranslatePhrase]);

  useEffect(() => {
    onWordTapRef.current = onWordTap;
  }, [onWordTap]);

  const notifySelectionChange = useCallback(() => {
    subscribersRef.current.forEach((cb) => cb());
  }, []);

  const notifyInteractionChange = useCallback(() => {
    interactionSubscribersRef.current.forEach((cb) => cb());
  }, []);

  const setSelectedPhrase = useCallback(
    (phrase: string | null) => {
      selectedPhraseRef.current = phrase;
      setSelectedPhraseState(phrase);
      notifyInteractionChange();
    },
    [notifyInteractionChange]
  );

  const subscribeSelection = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const subscribeInteractionState = useCallback((callback: () => void) => {
    interactionSubscribersRef.current.add(callback);
    return () => {
      interactionSubscribersRef.current.delete(callback);
    };
  }, []);

  const getInteractionState = useCallback(
    () => ({
      isDragging: isDraggingRef.current,
      hasPhrase: selectedPhraseRef.current !== null,
    }),
    []
  );

  const closeWordTooltip = useCallback(() => {
    setActiveWord(null);
  }, []);

  const handleWordClick = useCallback((input: ActiveWordState) => {
    const prev = activeWordRef.current;
    if (prev?.index === input.index) {
      setActiveWord(null);
      return;
    }
    if (prev !== null) {
      setActiveWord(null);
      return;
    }
    onWordTapRef.current?.();
    setActiveWord(input);
  }, []);

  const isIndexSelected = useCallback((index: number): boolean => {
    const range = getRange(dragStartRef.current, dragEndRef.current);
    return !!range && index >= range[0] && index <= range[1];
  }, []);

  const getSelectedIndices = useCallback((): number[] => {
    const range = getRange(dragStartRef.current, dragEndRef.current);
    if (!range) return [];
    return Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i);
  }, []);

  const registerWord = useCallback((index: number, word: string) => {
    wordsRef.current.set(index, word);
  }, []);

  const installDocumentDragListeners = useCallback(() => {
    if (documentListenersCleanupRef.current) return;
    documentListenersCleanupRef.current = addDocumentDragListeners(
      (index) => updateDragRef.current?.(index),
      () => endDragRef.current?.()
    );
  }, []);

  const removeDocumentDragListeners = useCallback(() => {
    documentListenersCleanupRef.current?.();
    documentListenersCleanupRef.current = null;
  }, []);

  const startDrag = useCallback(
    (index: number, element: HTMLElement) => {
      isDraggingRef.current = true;
      dragStartRef.current = index;
      dragEndRef.current = index;
      dragStartElementRef.current = element;
      installDocumentDragListeners();
      notifySelectionChange();
      notifyInteractionChange();
      startTransition(() => {
        setSelectedPhrase(null);
        setPhraseAnchorEl(null);
        setActiveWord(null);
      });
    },
    [
      notifySelectionChange,
      notifyInteractionChange,
      installDocumentDragListeners,
      setSelectedPhrase,
    ]
  );

  const updateDrag = useCallback(
    (index: number) => {
      if (!isDraggingRef.current) return;
      if (dragEndRef.current === index) return;
      dragEndRef.current = index;
      notifySelectionChange();
    },
    [notifySelectionChange]
  );

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    removeDocumentDragListeners();
    notifyInteractionChange();

    const range = getRange(dragStartRef.current, dragEndRef.current);
    const phrase = range && buildPhrase(wordsRef.current, range);
    const hasDragged = !!range && range[0] !== range[1];

    if (hasDragged && phrase) {
      setSelectedPhrase(phrase);
      setPhraseAnchorEl(dragStartElementRef.current);
      onTranslatePhraseRef.current?.(phrase);
    } else {
      dragStartRef.current = null;
      dragEndRef.current = null;
      notifySelectionChange();
    }
  }, [
    notifySelectionChange,
    notifyInteractionChange,
    removeDocumentDragListeners,
    setSelectedPhrase,
  ]);

  useEffect(() => {
    updateDragRef.current = updateDrag;
    endDragRef.current = endDrag;
  });

  const cancelDrag = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    dragEndRef.current = null;
    dragStartElementRef.current = null;
    removeDocumentDragListeners();
    notifySelectionChange();
    notifyInteractionChange();
    startTransition(() => {
      setSelectedPhrase(null);
      setPhraseAnchorEl(null);
    });
  }, [
    notifySelectionChange,
    notifyInteractionChange,
    removeDocumentDragListeners,
    setSelectedPhrase,
  ]);

  const closePhraseTooltip = useCallback(() => {
    dragStartRef.current = null;
    dragEndRef.current = null;
    setSelectedPhrase(null);
    setPhraseAnchorEl(null);
    notifySelectionChange();
  }, [notifySelectionChange, setSelectedPhrase]);

  const actions = useMemo<TranslatableTextActionsContextValue>(
    () => ({
      startDrag,
      updateDrag,
      endDrag,
      cancelDrag,
      registerWord,
      closePhraseTooltip,
      handleWordClick,
      closeWordTooltip,
      subscribeSelection,
      isIndexSelected,
      getSelectedIndices,
      subscribeInteractionState,
      getInteractionState,
    }),
    [
      startDrag,
      updateDrag,
      endDrag,
      cancelDrag,
      registerWord,
      closePhraseTooltip,
      handleWordClick,
      closeWordTooltip,
      subscribeSelection,
      isIndexSelected,
      getSelectedIndices,
      subscribeInteractionState,
      getInteractionState,
    ]
  );

  const uiValue = useMemo<TranslatableTextUIContextValue>(
    () => ({
      activeWord,
      phraseAnchorEl,
      selectedPhrase,
    }),
    [activeWord, phraseAnchorEl, selectedPhrase]
  );

  return (
    <TranslatableTextActionsContext.Provider value={actions}>
      <TranslatableTextUIContext.Provider value={uiValue}>
        <MemoizedChildTree>{children}</MemoizedChildTree>
        {overlays}
      </TranslatableTextUIContext.Provider>
    </TranslatableTextActionsContext.Provider>
  );
}
