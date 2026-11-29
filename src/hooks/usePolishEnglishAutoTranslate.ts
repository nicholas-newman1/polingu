import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { TRANSLATION_DEBOUNCE_MS } from '../constants/translation';
import { translate } from '../lib/translate';

type TranslationKey = string | number;

async function translateText(
  text: string,
  targetLang: 'EN' | 'PL',
  vocabulary?: boolean
): Promise<string | null> {
  try {
    const result = await translate(text, targetLang, { vocabulary });
    return result.translatedText;
  } catch {
    return null;
  }
}

interface DirectionOptions<K extends TranslationKey> {
  targetLang: 'EN' | 'PL';
  vocabulary?: boolean;
  getTargetValue: (key: K) => string | undefined;
  onTranslated: (key: K, translated: string) => void;
}

/**
 * Debounced translation of a source field into its counterpart. The counterpart
 * is written only when it is empty or still holds this hook's own previous
 * output, so it follows every change to the source, a wholesale replacement
 * included, while anything the user wrote or settled on is left alone.
 */
function useTranslateIntoEmptyField<K extends TranslationKey>({
  targetLang,
  vocabulary,
  getTargetValue,
  onTranslated,
}: DirectionOptions<K>) {
  const timeouts = useRef<Map<K, ReturnType<typeof setTimeout>>>(new Map());
  const [translatingKeys, setTranslatingKeys] = useState<Set<K>>(new Set());

  const latest = useRef({ getTargetValue, onTranslated });
  latest.current = { getTargetValue, onTranslated };

  // The value this hook last wrote into each counterpart.
  const autoFilled = useRef<Map<K, string>>(new Map());
  // Invalidate in-flight work on every source edit, before the next debounce fires.
  const generation = useRef(0);
  const sequences = useRef<Map<K, number>>(new Map());
  // Bumped when the user moves on, closing the replacement window for a key.
  const windowTokens = useRef<Map<K, number>>(new Map());

  useEffect(() => {
    const pending = timeouts.current;
    return () => {
      generation.current += 1;
      pending.forEach((timeout) => clearTimeout(timeout));
      pending.clear();
    };
  }, []);

  const canWrite = useCallback(
    (key: K, target: string) => !target || autoFilled.current.get(key) === target,
    []
  );

  const scheduleTranslation = useCallback(
    (key: K, sourceText: string) => {
      const existingTimeout = timeouts.current.get(key);
      if (existingTimeout) clearTimeout(existingTimeout);
      timeouts.current.delete(key);

      const startGeneration = generation.current;
      const sequence = (sequences.current.get(key) ?? 0) + 1;
      sequences.current.set(key, sequence);
      const isCurrent = () =>
        generation.current === startGeneration && sequences.current.get(key) === sequence;

      setTranslatingKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      // Emptying the source leaves an auto-filled counterpart replaceable by the next text.
      const trimmed = sourceText.trim();
      if (!trimmed) return;

      const targetBefore = (latest.current.getTargetValue(key) ?? '').trim();
      if (!canWrite(key, targetBefore)) return;
      // A pending translation may finish after blur, but must not reopen replacement.
      const windowToken = windowTokens.current.get(key) ?? 0;

      const timeout = setTimeout(async () => {
        if (!isCurrent()) return;
        timeouts.current.delete(key);

        if ((latest.current.getTargetValue(key) ?? '').trim() !== targetBefore) return;

        setTranslatingKeys((prev) => new Set(prev).add(key));
        try {
          const translated = await translateText(trimmed, targetLang, vocabulary);
          if (!translated) return;

          const isStale =
            !isCurrent() || (latest.current.getTargetValue(key) ?? '').trim() !== targetBefore;
          if (isStale) return;

          // If the window closed mid-flight the value still lands, but it is
          // not recorded, so it is the user's from here on.
          if ((windowTokens.current.get(key) ?? 0) === windowToken) {
            autoFilled.current.set(key, translated.trim());
          }
          latest.current.onTranslated(key, translated);
        } finally {
          if (isCurrent()) {
            setTranslatingKeys((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          }
        }
      }, TRANSLATION_DEBOUNCE_MS);

      timeouts.current.set(key, timeout);
    },
    [canWrite, targetLang, vocabulary]
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
  vocabulary?: boolean;
  getPolish: (key: K) => string | undefined;
  getEnglish: (key: K) => string | undefined;
  onPolishTranslated: (key: K, polish: string) => void;
  onEnglishTranslated: (key: K, english: string) => void;
}

/**
 * Keeps Polish/English field pairs, one per key, in sync in whichever direction is
 * needed: editing one side fills the other while that other side is empty or still
 * holds this hook's own auto-translation. Blurring a field settles
 * its counterpart, and every source edit invalidates pending translation results.
 */
export function usePolishEnglishAutoTranslate<K extends TranslationKey>({
  vocabulary,
  getPolish,
  getEnglish,
  onPolishTranslated,
  onEnglishTranslated,
}: AutoTranslateOptions<K>) {
  const toEnglish = useTranslateIntoEmptyField<K>({
    targetLang: 'EN',
    vocabulary,
    getTargetValue: getEnglish,
    onTranslated: onEnglishTranslated,
  });

  const toPolish = useTranslateIntoEmptyField<K>({
    targetLang: 'PL',
    getTargetValue: getPolish,
    onTranslated: onPolishTranslated,
  });

  const { cancelAll: cancelEnglish } = toEnglish;
  const { cancelAll: cancelPolish } = toPolish;
  const cancelAll = useCallback(() => {
    cancelEnglish();
    cancelPolish();
  }, [cancelEnglish, cancelPolish]);

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

/** Form field names holding the Polish and English halves of the pair. */
export interface PolishEnglishFieldNames {
  polish: string;
  english: string;
}

const DEFAULT_FIELD_NAMES: PolishEnglishFieldNames = { polish: 'polish', english: 'english' };

const FORM_PAIR = 'pair';

/**
 * `usePolishEnglishAutoTranslate` for a form's one Polish/English field pair,
 * named `polish` and `english` unless `fieldNames` says otherwise.
 */
export function usePolishEnglishFormAutoTranslate<T extends FieldValues>(
  form: Pick<UseFormReturn<T>, 'getValues' | 'setValue'>,
  options: { vocabulary?: boolean; fieldNames?: PolishEnglishFieldNames } = {}
) {
  // react-hook-form can't resolve literal paths against an unresolved generic form type.
  const { getValues, setValue } = form as unknown as Pick<
    UseFormReturn<Record<string, string>>,
    'getValues' | 'setValue'
  >;
  const { polish, english } = options.fieldNames ?? DEFAULT_FIELD_NAMES;
  const pair = usePolishEnglishAutoTranslate<typeof FORM_PAIR>({
    vocabulary: options.vocabulary,
    getPolish: () => getValues(polish),
    getEnglish: () => getValues(english),
    onPolishTranslated: (_key, value) => setValue(polish, value, { shouldValidate: true }),
    onEnglishTranslated: (_key, value) => setValue(english, value, { shouldValidate: true }),
  });

  return {
    handlePolishChange: (text: string) => pair.handlePolishChange(FORM_PAIR, text),
    handleEnglishChange: (text: string) => pair.handleEnglishChange(FORM_PAIR, text),
    handlePolishBlur: () => pair.handlePolishBlur(FORM_PAIR),
    handleEnglishBlur: () => pair.handleEnglishBlur(FORM_PAIR),
    isTranslatingEnglish: pair.isTranslatingEnglish(FORM_PAIR),
    isTranslatingPolish: pair.isTranslatingPolish(FORM_PAIR),
    cancel: pair.cancelAll,
  };
}

export type PolishEnglishFormAutoTranslate = ReturnType<typeof usePolishEnglishFormAutoTranslate>;
