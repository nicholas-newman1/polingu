import { describe, expect, test } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValueWhileOpen } from '../../src/hooks/useValueWhileOpen';

describe('useValueWhileOpen', () => {
  test('follows the value while open and keeps the last one while closed', () => {
    const { result, rerender } = renderHook(
      ({ value, open }: { value: string | null; open: boolean }) => useValueWhileOpen(value, open),
      { initialProps: { value: 'card-1' as string | null, open: true } }
    );
    expect(result.current).toBe('card-1');

    // The page clears the edited item as it closes the dialog.
    rerender({ value: null, open: false });
    expect(result.current).toBe('card-1');

    // Reopened to create a new item.
    rerender({ value: null, open: true });
    expect(result.current).toBeNull();

    rerender({ value: 'card-2', open: true });
    expect(result.current).toBe('card-2');
  });
});
