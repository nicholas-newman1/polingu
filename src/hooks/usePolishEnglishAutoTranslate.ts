import { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '../lib/translate';

export const AUTO_TRANSLATE_DEBOUNCE_MS = 500;

type TranslationKey = string | number;

const SINGLE_FIELD_KEY = 'single';

export function fieldHasContent(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}

async function translateText(text: string, targetLang: 'EN' | 'PL'): Promise<string | null> {
  try {
    const result = await translate(text, targetLang);
    return result.translatedText;
  } catch {
    return null;
  }
}

interface DirectionOptions<K extends TranslationKey> {
  targetLang: 'EN' | 'PL';
  getTargetValue: (key: K) => string | undefined;
  onTranslated: (key: K, translated: string) => void;
  debounceMs: number;
}

/**
 * Debounced translation of a source field into its counterpart, which is only
 * written when it is still empty. The counterpart is read from the form on
 * every check rather than mirrored locally, so a translation never lands on
 * top of existing text.
 */
function useTranslateIntoEmptyField<K extends TranslationKey>({
  targetLang,
  getTargetValue,
  onTranslated,
  debounceMs,
}: DirectionOptions<K>) {
  const timeouts = useRef<Map<K, ReturnType<typeof setTimeout>>>(new Map());
  const [translatingKeys, setTranslatingKeys] = useState<Set<K>>(new Set());

  const latest = useRef({ getTargetValue, onTranslated });
  latest.current = { getTargetValue, onTranslated };

  // Bumped by cancelAll so in-flight requests discard their result.
  const generation = useRef(0);

  useEffect(() => {
    const pending = timeouts.current;
    return () => {
      pending.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const scheduleTranslation = useCallback(
    (key: K, sourceText: string) => {
      const existingTimeout = timeouts.current.get(key);
      if (existingTimeout) clearTimeout(existingTimeout);

      const trimmed = sourceText.trim();
      if (!trimmed) return;

      const timeout = setTimeout(async () => {
        timeouts.current.delete(key);
        if (fieldHasContent(latest.current.getTargetValue(key))) return;

        const startGeneration = generation.current;
        setTranslatingKeys((prev) => new Set(prev).add(key));
        try {
          const translated = await translateText(trimmed, targetLang);
          const isStale =
            generation.current !== startGeneration ||
            fieldHasContent(latest.current.getTargetValue(key));
          if (translated && !isStale) {
            latest.current.onTranslated(key, translated);
          }
        } finally {
          setTranslatingKeys((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, debounceMs);

      timeouts.current.set(key, timeout);
    },
    [debounceMs, targetLang]
  );

  const isTranslating = useCallback((key: K) => translatingKeys.has(key), [translatingKeys]);

  const cancelAll = useCallback(() => {
    generation.current += 1;
    timeouts.current.forEach((timeout) => clearTimeout(timeout));
    timeouts.current.clear();
    setTranslatingKeys(new Set());
  }, []);

  return { scheduleTranslation, isTranslating, cancelAll };
}

interface AutoTranslateOptions<K extends TranslationKey> {
  getPolish: (key: K) => string | undefined;
  getEnglish: (key: K) => string | undefined;
  onPolishTranslated: (key: K, polish: string) => void;
  onEnglishTranslated: (key: K, english: string) => void;
  debounceMs?: number;
}

/**
 * Keeps a Polish/English field pair in sync in whichever direction is needed:
 * editing one side fills the other only while that other side is empty.
 * Scheduling with empty text cancels a pending translation for that key.
 */
export function usePolishEnglishAutoTranslate<K extends TranslationKey>({
  getPolish,
  getEnglish,
  onPolishTranslated,
  onEnglishTranslated,
  debounceMs = AUTO_TRANSLATE_DEBOUNCE_MS,
}: AutoTranslateOptions<K>) {
  const toEnglish = useTranslateIntoEmptyField<K>({
    targetLang: 'EN',
    getTargetValue: getEnglish,
    onTranslated: onEnglishTranslated,
    debounceMs,
  });

  const toPolish = useTranslateIntoEmptyField<K>({
    targetLang: 'PL',
    getTargetValue: getPolish,
    onTranslated: onPolishTranslated,
    debounceMs,
  });

  const cancelAll = useCallback(() => {
    toEnglish.cancelAll();
    toPolish.cancelAll();
  }, [toEnglish, toPolish]);

  return {
    handlePolishChange: toEnglish.scheduleTranslation,
    handleEnglishChange: toPolish.scheduleTranslation,
    isTranslatingEnglish: toEnglish.isTranslating,
    isTranslatingPolish: toPolish.isTranslating,
    cancelAll,
  };
}

/** Single Polish/English field pair variant of `usePolishEnglishAutoTranslate`. */
export function useSinglePolishEnglishAutoTranslate({
  getPolish,
  getEnglish,
  onPolishTranslated,
  onEnglishTranslated,
  debounceMs,
}: {
  getPolish: () => string | undefined;
  getEnglish: () => string | undefined;
  onPolishTranslated: (polish: string) => void;
  onEnglishTranslated: (english: string) => void;
  debounceMs?: number;
}) {
  const {
    handlePolishChange,
    handleEnglishChange,
    isTranslatingEnglish,
    isTranslatingPolish,
    cancelAll,
  } = usePolishEnglishAutoTranslate<string>({
    getPolish,
    getEnglish,
    onPolishTranslated: (_key, polish) => onPolishTranslated(polish),
    onEnglishTranslated: (_key, english) => onEnglishTranslated(english),
    debounceMs,
  });

  return {
    handlePolishChange: useCallback(
      (polish: string) => handlePolishChange(SINGLE_FIELD_KEY, polish),
      [handlePolishChange]
    ),
    handleEnglishChange: useCallback(
      (english: string) => handleEnglishChange(SINGLE_FIELD_KEY, english),
      [handleEnglishChange]
    ),
    isTranslatingEnglish: isTranslatingEnglish(SINGLE_FIELD_KEY),
    isTranslatingPolish: isTranslatingPolish(SINGLE_FIELD_KEY),
    cancel: cancelAll,
  };
}
