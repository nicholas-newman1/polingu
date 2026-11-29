/** Object URLs by key, keeping the `maxEntries` most recently used and revoking the rest. */
export function createObjectUrlLru(maxEntries: number) {
  const entries = new Map<string, string>();

  return {
    has: (key: string) => entries.has(key),

    /** The URL for `key`, marking it most recently used. */
    get(key: string): string | undefined {
      const url = entries.get(key);
      if (url !== undefined) {
        entries.delete(key);
        entries.set(key, url);
      }
      return url;
    },

    /** Adds `url` as the most recently used. An evicted `inUseUrl` is dropped without revoking it. */
    set(key: string, url: string, inUseUrl?: string | null) {
      entries.delete(key);
      entries.set(key, url);
      for (const [oldestKey, oldestUrl] of entries) {
        if (entries.size <= maxEntries) break;
        entries.delete(oldestKey);
        if (oldestUrl !== inUseUrl) URL.revokeObjectURL(oldestUrl);
      }
    },

    /** Revokes every URL. */
    clear() {
      for (const url of entries.values()) URL.revokeObjectURL(url);
      entries.clear();
    },
  };
}
