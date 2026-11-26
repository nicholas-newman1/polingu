import { describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useOptimisticModalSave,
  type ModalSaveResult,
} from '../../src/hooks/useOptimisticModalSave';
import { deferred } from './support/deferred';
import { withSnackbar } from './support/providers';

const SAVE_FAILED = 'Failed to save. Please try again.';

function renderSave(onSave: (name: string) => ModalSaveResult) {
  const { wrapper, showSnackbar } = withSnackbar();
  const onClose = vi.fn();
  const { result } = renderHook(() => useOptimisticModalSave({ onSave, onClose }), { wrapper });
  return { save: (name: string) => act(() => result.current(name)), onClose, showSnackbar };
}

describe('useOptimisticModalSave', () => {
  test('closes the modal without waiting for the save to finish', () => {
    const pending = deferred();
    const onSave = vi.fn(() => pending.promise);
    const h = renderSave(onSave);

    h.save('kot');
    expect(onSave).toHaveBeenCalledExactlyOnceWith('kot');
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.showSnackbar).not.toHaveBeenCalled();
  });

  test('keeps the modal open when the input is rejected', () => {
    const h = renderSave(() => false);
    h.save('');
    expect(h.onClose).not.toHaveBeenCalled();
    expect(h.showSnackbar).not.toHaveBeenCalled();
  });

  test('a save that fails after the modal closed is reported in a snackbar', async () => {
    const pending = deferred();
    const h = renderSave(() => pending.promise);
    h.save('kot');
    expect(h.onClose).toHaveBeenCalledTimes(1);

    await act(async () => pending.reject(new Error('offline')));
    expect(h.showSnackbar).toHaveBeenCalledExactlyOnceWith(SAVE_FAILED, 'error');
  });

  test('a save that throws straight away is reported and keeps the modal open', () => {
    const h = renderSave(() => {
      throw new Error('bad input');
    });
    h.save('kot');
    expect(h.showSnackbar).toHaveBeenCalledExactlyOnceWith(SAVE_FAILED, 'error');
    expect(h.onClose).not.toHaveBeenCalled();
  });

  test('a synchronous save closes the modal and reports nothing', async () => {
    const h = renderSave(() => undefined);
    h.save('kot');
    await act(async () => {});
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.showSnackbar).not.toHaveBeenCalled();
  });
});
