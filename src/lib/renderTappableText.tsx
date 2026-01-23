import { TappableWord } from '../components/TappableWord';

interface RenderTappableTextOptions {
  translations?: Record<string, string>;
  declensionCardId?: number;
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
    onDailyLimitReached,
    onUpdateTranslation,
    sentenceContext,
    isAdmin,
  } = options;
  const tokens = text.split(/(\s+)/);

  return tokens.map((token, index) => {
    if (/^\s+$/.test(token)) {
      return token;
    }
    const cleanToken = token.replace(/[.,!?;:"""''()]/g, '').toLowerCase();
    const cleanHighlight = highlightedWord
      ?.replace(/[.,!?;:"""''()]/g, '')
      .toLowerCase();
    const isHighlighted = !!(cleanHighlight && cleanToken === cleanHighlight);

    return (
      <TappableWord
        key={index}
        word={token}
        sentenceContext={sentenceContext}
        isHighlighted={isHighlighted}
        translations={translations}
        declensionCardId={declensionCardId}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={onUpdateTranslation}
        isAdmin={isAdmin}
      />
    );
  });
}
