export interface CustomItemBase {
  id: string;
  isCustom: true;
  createdAt: number;
}

export function createCustomItem<T extends object>(data: T): T & CustomItemBase {
  return { ...data, id: `custom_${Date.now()}`, isCustom: true, createdAt: Date.now() };
}
