import type { TranscriptFontSize } from '../../types/appSettings';

export const TEXT_LINE_HEIGHT = 1.8;

export const FONT_SIZE_MAP: Record<TranscriptFontSize, { base: string; sm: string }> = {
  small: { base: '1rem', sm: '1.2rem' },
  medium: { base: '1.3rem', sm: '1.5rem' },
  large: { base: '1.9rem', sm: '2.1rem' },
};

const PLACEHOLDER_FONT_PX: Record<TranscriptFontSize, number> = {
  small: 19,
  medium: 24,
  large: 34,
};

const PLACEHOLDER_WORDS_PER_LINE: Record<TranscriptFontSize, number> = {
  small: 12,
  medium: 10,
  large: 7,
};

/** Approximate rendered height of a not-yet-mounted block of text, to keep scroll stable. */
export function estimatePlaceholderHeight(wordCount: number, fontSize: TranscriptFontSize): number {
  const fontPx = PLACEHOLDER_FONT_PX[fontSize];
  const lineHeightPx = fontPx * TEXT_LINE_HEIGHT;
  const wordsPerLine = PLACEHOLDER_WORDS_PER_LINE[fontSize];
  const lines = Math.max(1, Math.ceil(wordCount / wordsPerLine));
  return Math.ceil(lines * lineHeightPx);
}
