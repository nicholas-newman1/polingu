import { createContext, useState, useCallback, type ReactNode } from 'react';
import type { TranslationResult } from '../lib/translate';

const MAX_CHARS_PER_DAY = 1500;

export interface TranslationContextValue {
  showTranslator: boolean;
  showLimitReached: boolean;
  limitResetTime: string;
  openTranslator: () => void;
  closeTranslator: () => void;
  closeLimitReached: () => void;
  handleDailyLimitReached: (resetTime: string) => void;
  handleTranslationSuccess: (result: TranslationResult) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const TranslationContext = createContext<TranslationContextValue | null>(null);

interface TranslationUsage {
  charsUsed: number;
  date: string;
  resetTime: string;
}

function getInitialUsage(): TranslationUsage | null {
  const stored = localStorage.getItem('translationUsage');
  if (stored) {
    const parsed = JSON.parse(stored);
    const today = new Date().toISOString().split('T')[0];
    if (parsed.date === today) {
      return parsed;
    }
  }
  return null;
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [translationUsage, setTranslationUsage] = useState<TranslationUsage | null>(
    getInitialUsage
  );
  const [showTranslator, setShowTranslator] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);
  const [limitResetTime, setLimitResetTime] = useState('');

  const openTranslator = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    if (
      translationUsage &&
      translationUsage.date === today &&
      translationUsage.charsUsed >= MAX_CHARS_PER_DAY
    ) {
      setLimitResetTime(translationUsage.resetTime);
      setShowLimitReached(true);
    } else {
      setShowTranslator(true);
    }
  }, [translationUsage]);

  const closeTranslator = useCallback(() => {
    setShowTranslator(false);
  }, []);

  const closeLimitReached = useCallback(() => {
    setShowLimitReached(false);
  }, []);

  const handleDailyLimitReached = useCallback((resetTime: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newUsage = {
      charsUsed: MAX_CHARS_PER_DAY,
      date: today,
      resetTime,
    };
    setTranslationUsage(newUsage);
    localStorage.setItem('translationUsage', JSON.stringify(newUsage));
    setLimitResetTime(resetTime);
    setShowLimitReached(true);
  }, []);

  const handleTranslationSuccess = useCallback((result: TranslationResult) => {
    const today = new Date().toISOString().split('T')[0];
    const newUsage = {
      charsUsed: result.charsUsedToday,
      date: today,
      resetTime: result.resetTime,
    };
    setTranslationUsage(newUsage);
    localStorage.setItem('translationUsage', JSON.stringify(newUsage));
  }, []);

  return (
    <TranslationContext.Provider
      value={{
        showTranslator,
        showLimitReached,
        limitResetTime,
        openTranslator,
        closeTranslator,
        closeLimitReached,
        handleDailyLimitReached,
        handleTranslationSuccess,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
}
