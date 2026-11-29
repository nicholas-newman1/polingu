import { useState } from 'react';

/** `value` while the dialog is open, then the last open value while it closes, so its fade-out doesn't change. */
export function useValueWhileOpen<T>(value: T, open: boolean): T {
  const [shown, setShown] = useState(value);
  if (open && shown !== value) setShown(value);
  return open ? value : shown;
}
