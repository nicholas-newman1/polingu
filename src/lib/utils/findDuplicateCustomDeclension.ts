import type { CustomDeclensionCard, DeclensionCardId } from '../../types';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function findCustomDeclensionDuplicate(
  cards: CustomDeclensionCard[],
  candidate: Pick<CustomDeclensionCard, 'front' | 'declined' | 'case' | 'gender' | 'number'>,
  excludeId?: DeclensionCardId
): CustomDeclensionCard | undefined {
  const front = normalize(candidate.front);
  const declined = normalize(candidate.declined);
  if (!front || !declined) return undefined;
  return cards.find(
    (c) =>
      c.id !== excludeId &&
      c.case === candidate.case &&
      c.gender === candidate.gender &&
      c.number === candidate.number &&
      normalize(c.front) === front &&
      normalize(c.declined) === declined
  );
}
