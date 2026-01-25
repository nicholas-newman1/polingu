import { TranslatableWord } from '../components/TranslatableWord';
import { TranslatableText } from '../components/TranslatableText';

interface RenderTappableTextOptions {
  translations?: Record<string, string>;
  declensionCardId?: number;
  sentenceId?: string;
  onDailyLimitReached?: (resetTime: string) => void;
  onUpdateTranslation?: (word: string, translation: string) => void;
  sentenceContext: string;
  isAdmin?: boolean;
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
    isAdmin,
  } = options;
  const tokens = text.split(/(\s+)/);

  let wordIndex = 0;
  const elements = tokens.map((token, index) => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    const cleanToken = token.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
    const cleanHighlight = highlightedWord
      ?.replace(/[.,!?;:"""''()]/g, '')
      .toLowerCase();
    const isHighlighted = !!(cleanHighlight && cleanToken === cleanHighlight);
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
        onUpdateTranslation={onUpdateTranslation}
        isAdmin={isAdmin}
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
