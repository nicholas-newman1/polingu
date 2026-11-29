import { useCallback, useMemo, useState } from 'react';
import { countWords } from '../../lib/utils/countWords';

interface TextBlocksOptions {
  /** The block the view opens at. */
  initialBlock: number;
  /** How many blocks either side of `initialBlock` render straight away. */
  initialBuffer: number;
}

/**
 * Long text made of blocks (paragraphs, transcript lines) read as one TranslatableText: where
 * each block's words are numbered from, the blocks to render first, the blocks a selected
 * phrase spans as its translation context, and the phrase translations fetched so far.
 */
export function useTextBlocks(texts: string[], { initialBlock, initialBuffer }: TextBlocksOptions) {
  const wordCounts = useMemo(() => texts.map((text) => countWords(text)), [texts]);

  const wordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const count of wordCounts) {
      offsets.push(total);
      total += count;
    }
    return offsets;
  }, [wordCounts]);

  const initiallyVisible = useMemo(() => {
    const set = new Set<number>();
    const start = Math.max(0, initialBlock - initialBuffer);
    const end = Math.min(texts.length - 1, initialBlock + initialBuffer);
    for (let i = start; i <= end; i++) set.add(i);
    return set;
  }, [initialBlock, initialBuffer, texts.length]);

  const getSentenceContext = useCallback(
    (selectedIndices: number[]) => {
      if (selectedIndices.length === 0 || texts.length === 0) return undefined;
      let min = Infinity;
      let max = -Infinity;
      for (const idx of selectedIndices) {
        if (idx < min) min = idx;
        if (idx > max) max = idx;
      }
      let firstBlock = 0;
      let lastBlock = 0;
      for (let i = 0; i < wordOffsets.length; i++) {
        if (wordOffsets[i] <= min) firstBlock = i;
        if (wordOffsets[i] <= max) lastBlock = i;
      }
      return texts.slice(firstBlock, lastBlock + 1).join(' ');
    },
    [wordOffsets, texts]
  );

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const updateTranslation = useCallback((key: string, translation: string) => {
    setTranslations((prev) => ({ ...prev, [key]: translation }));
  }, []);

  return {
    wordCounts,
    wordOffsets,
    initiallyVisible,
    getSentenceContext,
    translations,
    updateTranslation,
  };
}
