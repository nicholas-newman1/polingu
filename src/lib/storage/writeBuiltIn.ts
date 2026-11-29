/**
 * Saves an admin's change to built-in items, showing `changed` in place of `items`
 * straight away. A refused write puts `items` back and is rethrown for the caller to report.
 */
export async function writeBuiltIn<T>(
  items: T[],
  setItems: (items: T[]) => void,
  changed: T[],
  persist: () => Promise<void>
): Promise<void> {
  setItems(changed);
  try {
    await persist();
  } catch (e) {
    setItems(items);
    throw e;
  }
}
