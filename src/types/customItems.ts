export type ItemId = number | string;

export interface CustomItemBase {
  id: string;
  isCustom: true;
  createdAt: number;
}

export type AsCustom<T extends { id: number | string }> = Omit<T, 'id' | 'isCustom'> &
  CustomItemBase;

export function isCustomId(id: ItemId): id is string {
  return typeof id === 'string' && id.startsWith('custom_');
}

export function generateCustomId(): string {
  return `custom_${Date.now()}`;
}
