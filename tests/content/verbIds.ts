/** CONJUGATION.md "ID Format": the infinitive in ASCII, with spaces as hyphens (myć się → myc-sie). */
export const asciiVerbId = (infinitive: string) =>
  infinitive
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase()
    .replace(/\s+/g, '-');
