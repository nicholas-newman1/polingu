export function normalizeVocabularyPrefill(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return trimmed
    .toLowerCase()
    .replace(/\p{P}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
