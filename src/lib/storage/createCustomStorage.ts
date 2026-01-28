import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getUserId } from './helpers';
import { stripUndefined } from './firestoreUtils';
import type { CustomItemBase } from '../../types/customItems';
import { generateCustomId } from '../../types/customItems';

interface StorageOptions {
  documentKey?: string;
}

export function createCustomStorage<T extends CustomItemBase>(
  storeName: string,
  options: StorageOptions = {}
) {
  const { documentKey = 'items' } = options;

  const getDocRef = () => {
    const userId = getUserId();
    if (!userId) return null;
    return doc(db, 'users', userId, 'data', storeName);
  };

  return {
    async load(): Promise<T[]> {
      const docRef = getDocRef();
      if (!docRef) return [];
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Record<string, T[]>;
          return data[documentKey] || [];
        }
      } catch (e) {
        console.error(`Failed to load ${storeName}:`, e);
      }
      return [];
    },

    async save(items: T[]): Promise<void> {
      const docRef = getDocRef();
      if (!docRef) return;
      const cleanedItems = items.map(stripUndefined);
      await setDoc(docRef, { [documentKey]: cleanedItems });
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
