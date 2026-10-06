export interface CustomItemBase {
  id: string;
  isCustom: true;
  createdAt: number;
}

export function generateCustomId(): string {
  return `custom_${Date.now()}`;
}

export function createCustomItem<T extends object>(data: T): T & CustomItemBase {
  return { ...data, id: generateCustomId(), isCustom: true, createdAt: Date.now() };
}
