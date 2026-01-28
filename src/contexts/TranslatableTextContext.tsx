import { createContext, useState, useCallback, useRef } from 'react';

export interface TranslatableTextContextValue {
  isDragging: boolean;
  selectedIndices: Set<number>;
  phraseAnchorEl: HTMLElement | null;
  selectedPhrase: string | null;
  startDrag: (index: number, element: HTMLElement) => void;
  updateDrag: (index: number) => void;
  endDrag: () => void;
  cancelDrag: () => void;
  registerWord: (index: number, word: string) => void;
  closePhraseTooltip: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const TranslatableTextContext = createContext<TranslatableTextContextValue | null>(null);

interface TranslatableTextProviderProps {
  children: React.ReactNode;
  onTranslatePhrase?: (phrase: string) => void;
}

export function TranslatableTextProvider({
  children,
  onTranslatePhrase,
}: TranslatableTextProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [phraseAnchorEl, setPhraseAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null);
  const wordsRef = useRef<Map<number, string>>(new Map());
  const dragStartElementRef = useRef<HTMLElement | null>(null);

  const selectedIndices = new Set<number>();
  if (dragStart !== null && dragEnd !== null) {
    const min = Math.min(dragStart, dragEnd);
    const max = Math.max(dragStart, dragEnd);
    for (let i = min; i <= max; i++) {
      selectedIndices.add(i);
    }
  }

  const registerWord = useCallback((index: number, word: string) => {
    wordsRef.current.set(index, word);
  }, []);

  const startDrag = useCallback((index: number, element: HTMLElement) => {
    setIsDragging(true);
    setDragStart(index);
    setDragEnd(index);
    dragStartElementRef.current = element;
    setSelectedPhrase(null);
    setPhraseAnchorEl(null);
  }, []);

  const updateDrag = useCallback(
    (index: number) => {
      if (!isDragging) return;
      setDragEnd(index);
    },
    [isDragging]
  );

  const buildPhrase = useCallback(() => {
    if (dragStart === null || dragEnd === null) return null;
    const min = Math.min(dragStart, dragEnd);
    const max = Math.max(dragStart, dragEnd);

    const words: string[] = [];
    for (let i = min; i <= max; i++) {
      const word = wordsRef.current.get(i);
      if (word) words.push(word);
    }
    return words.join(' ');
  }, [dragStart, dragEnd]);

  const endDrag = useCallback(() => {
    if (!isDragging) return;

    const phrase = buildPhrase();
    const hasDragged = dragStart !== null && dragEnd !== null && dragStart !== dragEnd;

    setIsDragging(false);

    if (hasDragged && phrase) {
      setSelectedPhrase(phrase);
      setPhraseAnchorEl(dragStartElementRef.current);
      onTranslatePhrase?.(phrase);
    } else {
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging, dragStart, dragEnd, buildPhrase, onTranslatePhrase]);

  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setSelectedPhrase(null);
    setPhraseAnchorEl(null);
    dragStartElementRef.current = null;
  }, []);

  const closePhraseTooltip = useCallback(() => {
    setSelectedPhrase(null);
    setPhraseAnchorEl(null);
    setDragStart(null);
    setDragEnd(null);
  }, []);

  return (
    <TranslatableTextContext.Provider
      value={{
        isDragging,
        selectedIndices,
        phraseAnchorEl,
        selectedPhrase,
        startDrag,
        updateDrag,
        endDrag,
        cancelDrag,
        registerWord,
        closePhraseTooltip,
      }}
    >
      {children}
    </TranslatableTextContext.Provider>
  );
}
