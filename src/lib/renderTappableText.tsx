import { TranslatableWord } from '../components/TranslatableWord';
import { TranslatableText } from '../components/TranslatableText';
import { translationCacheKey } from './translate';

interface RenderTappableTextOptions {
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
  sentenceContext: string;
}

export function renderTappableText(
  text: string,
  options: RenderTappableTextOptions,
  highlightedWord?: string
) {
  const {
    translations,
    declensionCardId,
    sentenceId,
    onDailyLimitReached,
    onUpdateTranslation,
    sentenceContext,
  } = options;
  const tokens = text.split(/(\s+)/);
  const cleanHighlight = highlightedWord && translationCacheKey(highlightedWord);

  let wordIndex = 0;
  const elements = tokens.map((token, index) => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    const isHighlighted = !!(cleanHighlight && translationCacheKey(token) === cleanHighlight);
    const currentWordIndex = wordIndex;
    wordIndex++;

    return (
      <TranslatableWord
        key={index}
        word={token}
        wordIndex={currentWordIndex}
        sentenceContext={sentenceContext}
        isHighlighted={isHighlighted}
        translations={translations}
        declensionCardId={declensionCardId}
        sentenceId={sentenceId}
        onDailyLimitReached={onDailyLimitReached}
      />
    );
  });

  return (
    <TranslatableText
      sentenceContext={sentenceContext}
      translations={translations}
      declensionCardId={declensionCardId}
      sentenceId={sentenceId}
      onDailyLimitReached={onDailyLimitReached}
      onUpdateTranslation={onUpdateTranslation}
    >
      {elements}
    </TranslatableText>
  );
}
