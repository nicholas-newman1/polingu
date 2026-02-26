import { useState, useCallback } from 'react';

export interface CardHistoryState<T> {
  history: T[];
  historyIndex: number | null;
}

export interface CardHistoryActions<T> {
  addToHistory: (card: T) => void;
  goBack: () => void;
  goForward: () => void;
  clearHistory: () => void;
}

export interface CardHistoryResult<T> extends CardHistoryState<T>, CardHistoryActions<T> {
  isViewingHistory: boolean;
  historyCard: T | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function useCardHistory<T>(): CardHistoryResult<T> {
  const [history, setHistory] = useState<T[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const isViewingHistory = historyIndex !== null;
  const historyCard = isViewingHistory ? history[historyIndex] : null;
  const canGoBack = history.length > 0 && (historyIndex === null || historyIndex > 0);
  const canGoForward = historyIndex !== null;

  const addToHistory = useCallback((card: T) => {
    setHistory((prev) => [...prev, card]);
    setHistoryIndex(null);
  }, []);

  const goBack = useCallback(() => {
    if (!canGoBack) return;

    if (historyIndex === null) {
      setHistoryIndex(history.length - 1);
    } else if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  }, [canGoBack, historyIndex, history.length]);

  const goForward = useCallback(() => {
    if (historyIndex === null) return;

    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    } else {
      setHistoryIndex(null);
    }
  }, [historyIndex, history.length]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setHistoryIndex(null);
  }, []);

  return {
    history,
    historyIndex,
    isViewingHistory,
    historyCard,
    canGoBack,
    canGoForward,
    addToHistory,
    goBack,
    goForward,
    clearHistory,
  };
}
