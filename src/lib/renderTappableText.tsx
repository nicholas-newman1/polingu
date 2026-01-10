import { TappableWord } from '../components/TappableWord';

interface RenderTappableTextOptions {
  translationCache: React.MutableRefObject<Map<string, string>>;
  onDailyLimitReached?: (resetTime: string) => void;
}

export function renderTappableText(
  text: string,
  options: RenderTappableTextOptions,
  highlightedWord?: string
) {
  const { translationCache, onDailyLimitReached } = options;
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
        sentenceContext={text}
        isHighlighted={isHighlighted}
        translationCache={translationCache}
        onDailyLimitReached={onDailyLimitReached}
      />
    );
  });
}

