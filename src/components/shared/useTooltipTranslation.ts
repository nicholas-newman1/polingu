import { useCallback, useEffect, useRef, useState } from 'react';
import { handleTooltipTranslationError, type TranslationResult } from '../../lib/translate';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useTranslatableTextActions } from '../../contexts/TranslatableTextContext';

interface Lookup {
  text: string | null;
  translation: string | null;
  error: string | null;
  pending: Promise<TranslationResult> | null;
}

/**
 * The translation a word or phrase tooltip shows for `text`. Only the latest lookup lands, so
 * a late answer for an earlier word or phrase never replaces the current one. Reaching the
 * daily limit closes the tooltip with `close` and opens the limit dialog.
 */
export function useTooltipTranslation(text: string | null, close: () => void) {
  const { handleDailyLimitReached } = useTranslatableTextActions();
  const { showSnackbar } = useSnackbar();
  const [lookup, setLookupState] = useState<Lookup | null>(null);
  const latestRef = useRef<Lookup | null>(null);

  const setLookup = useCallback((next: Lookup | null) => {
    latestRef.current = next;
    setLookupState(next);
  }, []);

  // A lookup that finishes after the tooltip has gone must not report a failure or the limit.
  useEffect(
    () => () => {
      latestRef.current = null;
    },
    []
  );

  /** Shows a translation already known (or none), dropping any lookup still under way. */
  const show = useCallback(
    (translation: string | null, error: string | null = null) =>
      setLookup({ text, translation, error, pending: null }),
    [text, setLookup]
  );

  /**
   * Shows `pending`'s answer once it arrives. Resolves to the translation, or to null if the
   * lookup failed or another one replaced it.
   */
  const lookUp = useCallback(
    async (pending: Promise<TranslationResult>): Promise<string | null> => {
      const started: Lookup = { text, translation: null, error: null, pending };
      setLookup(started);
      try {
        const { translatedText } = await pending;
        if (latestRef.current !== started) return null;
        setLookup({ text, translation: translatedText, error: null, pending: null });
        return translatedText;
      } catch (err) {
        if (latestRef.current !== started) return null;
        setLookup({ text, translation: null, error: null, pending: null });
        handleTooltipTranslationError(err, {
          setError: (error) => setLookup({ text, translation: null, error, pending: null }),
          showSnackbar,
          onDailyLimit: (resetTime) => {
            close();
            handleDailyLimitReached(resetTime);
          },
        });
        return null;
      }
    },
    [text, setLookup, showSnackbar, close, handleDailyLimitReached]
  );

  const current = lookup?.text === text ? lookup : null;
  return {
    translation: current?.translation ?? null,
    error: current?.error ?? null,
    loading: !!current?.pending,
    pending: current?.pending ?? null,
    show,
    lookUp,
  };
}
