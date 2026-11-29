import { useMemo, memo } from 'react';
import { TranslatableWord } from '../TranslatableWord';

interface TranslatableWordsProps {
  text: string;
  /** Index of the first word in `text` within the whole document. */
  wordOffset: number;
}

/** Renders each word of `text` as a tappable translation, preserving the original whitespace. */
export const TranslatableWords = memo(function TranslatableWords({
  text,
  wordOffset,
}: TranslatableWordsProps) {
  const elements = useMemo(() => {
    let wordIndex = 0;
    return text.split(/(\s+)/).map((token, index) => {
      if (/^\s+$/.test(token)) return token;
      const currentWordIndex = wordIndex;
      wordIndex++;

      return (
        <TranslatableWord
          key={index}
          word={token}
          wordIndex={wordOffset + currentWordIndex}
          sentenceContext={text}
          disableHoverTranslate
        />
      );
    });
  }, [text, wordOffset]);

  return <>{elements}</>;
});
