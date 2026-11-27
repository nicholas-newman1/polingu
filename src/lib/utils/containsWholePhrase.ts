const toWords = (text: string) =>
  text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Whether `phrase` appears in `sentence` as whole words, ignoring case and punctuation:
 * "kota" is in "Nie mam kota!" but not in "Nie mam kotka.".
 */
export function containsWholePhrase(sentence: string, phrase: string): boolean {
  const target = toWords(phrase);
  if (target.length === 0) return false;
  const words = toWords(sentence);
  return words.some((_, start) => target.every((word, i) => words[start + i] === word));
}
