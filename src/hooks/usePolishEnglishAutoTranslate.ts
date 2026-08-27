import { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '../lib/translate';

export const AUTO_TRANSLATE_DEBOUNCE_MS = 500;

type TranslationKey = string | number;

const SINGLE_FIELD_KEY = 'single';

async function translateText(text: string, targetLang: 'EN' | 'PL'): Promise<string | null> {
  try {
    const result = await translate(text, targetLang);
    return result.translatedText;
  } catch {
    return null;
  }
}

/**
 * True while the source is still being composed rather than reworked: the new
 * text either extends the previously translated text or backspaces into it.
 * An edit in the middle is treated as a deliberate refinement instead.
 */
function isContinuedEdit(source: string, previousSource: string): boolean {
  return source.startsWith(previousSource) || previousSource.startsWith(source);
}

interface AutoFilledValue {
  source: string;
  written: string;
}

interface DirectionOptions<K extends TranslationKey> {
  targetLang: 'EN' | 'PL';
  getTargetValue: (key: K) => string | undefined;
  onTranslated: (key: K, translated: string) => void;
  debounceMs: number;
}

/**
 * Debounced translation of a source field into its counterpart. The counterpart
 * is written only when it is empty, or when it still holds this hook's own
 * previous output and the source is being extended rather than reworked, so a
 * translation fired mid-sentence corrects itself as typing continues while
 * anything the user wrote or settled on is left alone.
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

  const autoFilled = useRef<Map<K, AutoFilledValue>>(new Map());
  // Only the newest request per key may write; bumped by cancelAll and per fire.
  const generation = useRef(0);
  const sequences = useRef<Map<K, number>>(new Map());
  // Bumped when the user moves on, closing the replacement window for a key.
  const windowTokens = useRef<Map<K, number>>(new Map());

  useEffect(() => {
    const pending = timeouts.current;
    return () => {
      pending.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const canWrite = useCallback((key: K, source: string, target: string) => {
    if (!target) return true;
    const previous = autoFilled.current.get(key);
    if (!previous || previous.written !== target) return false;
    return isContinuedEdit(source, previous.source);
  }, []);

  const scheduleTranslation = useCallback(
    (key: K, sourceText: string) => {
      const existingTimeout = timeouts.current.get(key);
      if (existingTimeout) clearTimeout(existingTimeout);

      const trimmed = sourceText.trim();
      if (!trimmed) {
        // Emptying the source restarts the pair: whatever was auto-filled from
        // it stays replaceable by the next thing typed.
        const previous = autoFilled.current.get(key);
        if (previous) autoFilled.current.set(key, { ...previous, source: '' });
        return;
      }

      const timeout = setTimeout(async () => {
        timeouts.current.delete(key);

        const targetBefore = (latest.current.getTargetValue(key) ?? '').trim();
        if (!canWrite(key, trimmed, targetBefore)) return;

        const startGeneration = generation.current;
        const sequence = (sequences.current.get(key) ?? 0) + 1;
        sequences.current.set(key, sequence);
        const windowToken = windowTokens.current.get(key) ?? 0;

        setTranslatingKeys((prev) => new Set(prev).add(key));
        try {
          const translated = await translateText(trimmed, targetLang);
          if (!translated) return;

          const isStale =
            generation.current !== startGeneration ||
            sequences.current.get(key) !== sequence ||
            (latest.current.getTargetValue(key) ?? '').trim() !== targetBefore;
          if (isStale) return;

          // If the window closed mid-flight the value still lands, but it is
          // not recorded, so it is the user's from here on.
          if ((windowTokens.current.get(key) ?? 0) === windowToken) {
            autoFilled.current.set(key, { source: trimmed, written: translated.trim() });
          }
          latest.current.onTranslated(key, translated);
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
    [canWrite, debounceMs, targetLang]
  );

  const closeReplacementWindow = useCallback((key: K) => {
    autoFilled.current.delete(key);
    windowTokens.current.set(key, (windowTokens.current.get(key) ?? 0) + 1);
  }, []);

  const isTranslating = useCallback((key: K) => translatingKeys.has(key), [translatingKeys]);

  const cancelAll = useCallback(() => {
    generation.current += 1;
    timeouts.current.forEach((timeout) => clearTimeout(timeout));
    timeouts.current.clear();
    autoFilled.current.clear();
    sequences.current.clear();
    setTranslatingKeys(new Set());
  }, []);

  return { scheduleTranslation, closeReplacementWindow, isTranslating, cancelAll };
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
 * editing one side fills the other while that other side is empty or still
 * holds an auto-translation of what is being typed. Blurring a field settles
 * its counterpart, and scheduling with empty text cancels a pending request.
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
    handlePolishBlur: toEnglish.closeReplacementWindow,
    handleEnglishBlur: toPolish.closeReplacementWindow,
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
    handlePolishBlur,
    handleEnglishBlur,
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
    handlePolishBlur: useCallback(() => handlePolishBlur(SINGLE_FIELD_KEY), [handlePolishBlur]),
    handleEnglishBlur: useCallback(() => handleEnglishBlur(SINGLE_FIELD_KEY), [handleEnglishBlur]),
    isTranslatingEnglish: isTranslatingEnglish(SINGLE_FIELD_KEY),
    isTranslatingPolish: isTranslatingPolish(SINGLE_FIELD_KEY),
    cancel: cancelAll,
  };
}
