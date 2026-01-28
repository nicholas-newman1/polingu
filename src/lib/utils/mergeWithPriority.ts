export interface PrioritizableItem {
  id: number | string;
  isCustom?: boolean;
}

export function mergeWithPriority<T extends PrioritizableItem>(
  customItems: T[],
  systemItems: T[]
): T[] {
  return [...customItems, ...systemItems];
}

export function separateByCustom<T extends PrioritizableItem>(
  items: T[]
): { customItems: T[]; systemItems: T[] } {
  const customItems: T[] = [];
  const systemItems: T[] = [];
  for (const item of items) {
    if (item.isCustom) {
      customItems.push(item);
    } else {
      systemItems.push(item);
    }
  }
  return { customItems, systemItems };
}
