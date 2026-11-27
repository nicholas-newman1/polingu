/**
 * Lower-cases `text` and strips its diacritics, so a search typed without Polish letters
 * still matches: "zyraf" finds "żyrafa". Ł has no decomposed form, so it is mapped by hand.
 */
export function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}

/** Whether `query` (already folded) appears in any of `fields`, ignoring case and diacritics. */
export function matchesSearch(
  foldedQuery: string,
  ...fields: (string | undefined | null)[]
): boolean {
  if (!foldedQuery) return true;
  return fields.some((field) => !!field && foldForSearch(field).includes(foldedQuery));
}
