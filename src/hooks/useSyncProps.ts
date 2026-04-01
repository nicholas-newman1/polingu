import { useState } from 'react';

/**
 * Render-time state adjustment hook. Detects when any tracked prop reference
 * changes and calls `onSync` so the component can update its internal state
 * without a useEffect (which React 19 disallows for synchronous setState).
 */
export function useSyncProps(props: Record<string, unknown>, onSync: () => void): void {
  const [prev, setPrev] = useState(props);
  const changed = Object.keys(props).some((k) => prev[k] !== props[k]);
  if (changed) {
    setPrev(props);
    onSync();
  }
}
