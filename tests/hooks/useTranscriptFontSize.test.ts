import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTranscriptFontSize } from '../../src/hooks/useTranscriptFontSize';

const STORAGE_KEY = 'polingu_transcriptFontSize';

const renderFontSize = () => renderHook(() => useTranscriptFontSize());

describe('useTranscriptFontSize', () => {
  test('defaults to large when nothing is saved', () => {
    const { result } = renderFontSize();
    expect(result.current[0]).toBe('large');
  });

  test.each(['small', 'medium', 'large'] as const)('restores a saved %s size', (size) => {
    localStorage.setItem(STORAGE_KEY, size);
    const { result } = renderFontSize();
    expect(result.current[0]).toBe(size);
  });

  test('ignores a saved value that is not a known size', () => {
    localStorage.setItem(STORAGE_KEY, 'huge');
    const { result } = renderFontSize();
    expect(result.current[0]).toBe('large');
  });

  test('changing the size shows it now and remembers it for the next visit', () => {
    const first = renderFontSize();

    act(() => first.result.current[1]('small'));

    expect(first.result.current[0]).toBe('small');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('small');
    expect(renderFontSize().result.current[0]).toBe('small');
  });

  test('still works when storage is unavailable, without remembering the choice', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderFontSize();
    expect(result.current[0]).toBe('large');

    act(() => result.current[1]('medium'));
    expect(result.current[0]).toBe('medium');
  });

  test('the setter keeps its identity across renders', () => {
    const { result, rerender } = renderFontSize();
    const setter = result.current[1];

    act(() => setter('small'));
    rerender();

    expect(result.current[1]).toBe(setter);
  });
});
