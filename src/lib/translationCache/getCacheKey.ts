import hashContext from './hashContext';

export default function getCacheKey(word: string, context?: string): string {
  if (!context) return word;
  return `${word}__${hashContext(context)}`;
}

