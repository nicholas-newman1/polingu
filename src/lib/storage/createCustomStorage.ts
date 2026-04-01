import { stripUndefined } from './firestoreUtils';
import type { CustomItemBase } from '../../types/customItems';
import { generateCustomId } from '../../types/customItems';
import { loadUserData, saveUserData } from '../offlineDb/userDataWrapper';

interface StorageOptions {
  documentKey?: string;
}

export function createCustomStorage<T extends CustomItemBase>(
  storeName: string,
  options: StorageOptions = {}
) {
  const { documentKey = 'items' } = options;

  return {
    async load(): Promise<T[]> {
      return loadUserData<T[]>(storeName, [], (data) => {
        const record = data as Record<string, T[]>;
        return record[documentKey] || [];
      });
    },

    async save(items: T[]): Promise<void> {
      const cleanedItems = items.map(stripUndefined);
      await saveUserData(storeName, { [documentKey]: cleanedItems });
    },

    async add(data: Omit<T, 'id' | 'isCustom' | 'createdAt'>): Promise<T> {
      const existingItems = await this.load();
      const newItem = {
        ...data,
        id: generateCustomId(),
        isCustom: true,
        createdAt: Date.now(),
      } as T;
      await this.save([...existingItems, newItem]);
      return newItem;
    },

    async update(
      id: string,
      updates: Partial<Omit<T, 'id' | 'isCustom' | 'createdAt'>>
    ): Promise<void> {
      const items = await this.load();
      const updated = items.map((item) => (item.id === id ? { ...item, ...updates } : item));
      await this.save(updated);
    },

    async delete(id: string): Promise<void> {
      const items = await this.load();
      await this.save(items.filter((item) => item.id !== id));
    },
  };
}
