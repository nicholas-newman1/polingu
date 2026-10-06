export function printBreakdown<T>(label: string, items: T[], getKey: (item: T) => string): void {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log(`  Breakdown by ${label}:`);
  [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, count]) => {
      console.log(`    ${key}: ${count}`);
    });
}
