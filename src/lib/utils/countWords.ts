export function countWords(text: string): number {
  return text.split(/(\s+)/).filter((t) => t.length > 0 && !/^\s+$/.test(t)).length;
}
