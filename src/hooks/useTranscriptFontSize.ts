import { useState, useCallback } from 'react';
import type { TranscriptFontSize } from '../types/appSettings';

const STORAGE_KEY = 'polingu_transcriptFontSize';
const DEFAULT_SIZE: TranscriptFontSize = 'large';
const VALID_SIZES: ReadonlySet<string> = new Set<TranscriptFontSize>(['small', 'medium', 'large']);

function readStored(): TranscriptFontSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && VALID_SIZES.has(value)) return value as TranscriptFontSize;
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_SIZE;
}

export function useTranscriptFontSize() {
  const [fontSize, setFontSize] = useState<TranscriptFontSize>(readStored);

  const updateFontSize = useCallback((size: TranscriptFontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem(STORAGE_KEY, size);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  return [fontSize, updateFontSize] as const;
}
