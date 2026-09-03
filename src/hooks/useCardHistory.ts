import { useState, useCallback } from 'react';

export interface CardHistoryState<T> {
  history: T[];
  historyIndex: number | null;
}

export interface CardHistoryActions<T, M> {
  addToHistory: (card: T, meta?: M) => void;
  updateInHistory: (predicate: (item: T) => boolean, updater: (item: T) => T) => void;
  goBack: () => void;
  goForward: () => void;
  clearHistory: () => void;
}

export interface CardHistoryResult<T, M = undefined>
  extends CardHistoryState<T>, CardHistoryActions<T, M> {
  isViewingHistory: boolean;
  historyCard: T | null;
  historyMeta: M | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function useCardHistory<T, M = undefined>(): CardHistoryResult<T, M> {
  const [history, setHistory] = useState<T[]>([]);
  const [metaHistory, setMetaHistory] = useState<Array<M | undefined>>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const isViewingHistory = historyIndex !== null;
  const historyCard = isViewingHistory ? history[historyIndex] : null;
  const historyMeta = isViewingHistory ? ((metaHistory[historyIndex] ?? null) as M | null) : null;
  const canGoBack = history.length > 0 && (historyIndex === null || historyIndex > 0);
  const canGoForward = historyIndex !== null;

  const addToHistory = useCallback((card: T, meta?: M) => {
    setHistory((prev) => [...prev, card]);
    setMetaHistory((prev) => [...prev, meta]);
    setHistoryIndex(null);
  }, []);

  const updateInHistory = useCallback(
    (predicate: (item: T) => boolean, updater: (item: T) => T) => {
      setHistory((prev) => prev.map((item) => (predicate(item) ? updater(item) : item)));
    },
    []
  );

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
    setMetaHistory([]);
    setHistoryIndex(null);
  }, []);

  return {
    history,
    historyIndex,
    isViewingHistory,
    historyCard,
    historyMeta,
    canGoBack,
    canGoForward,
    addToHistory,
    updateInHistory,
    goBack,
    goForward,
    clearHistory,
  };
}
