import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEditModal } from '../../src/hooks/useEditModal';
import type { ModalSaveResult } from '../../src/hooks/useOptimisticModalSave';
import { withSnackbar } from './support/providers';

interface Fields {
  polish: string;
  english: string;
}

beforeEach(() => {
  window.history.replaceState(null, '');
});

function renderModal(onSave: (data: Fields) => ModalSaveResult = () => undefined) {
  const onClose = vi.fn();
  const reset = vi.fn();
  const onAudioUpdated = vi.fn();
  const { wrapper, showSnackbar } = withSnackbar();
  const hook = renderHook(
    ({ open }) => useEditModal<[Fields]>({ open, onClose, onSave, reset, onAudioUpdated }),
    { wrapper, initialProps: { open: true } }
  );
  const modal = () => hook.result.current;
  return { ...hook, modal, onClose, reset, onAudioUpdated, showSnackbar };
}

describe('useEditModal', () => {
  test('saving closes and resets the modal', () => {
    const onSave = vi.fn(() => undefined);
    const h = renderModal(onSave);

    act(() => h.modal().save({ polish: 'kot', english: 'cat' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ polish: 'kot', english: 'cat' });
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.reset).toHaveBeenCalledTimes(1);
  });

  test('a rejected input keeps the modal open and its contents', () => {
    const h = renderModal(() => false);
    act(() => h.modal().save({ polish: 'kot', english: '' }));
    expect(h.onClose).not.toHaveBeenCalled();
    expect(h.reset).not.toHaveBeenCalled();
  });

  test('pressing back closes and resets the modal', () => {
    const h = renderModal();
    expect(window.history.state?.backClose).toEqual(expect.any(String));

    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: null })));
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.reset).toHaveBeenCalledTimes(1);
  });

  test('closing the modal itself removes the history entry it added', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const h = renderModal();
    act(() => h.modal().handleClose());
    h.rerender({ open: false });
    expect(back).toHaveBeenCalledTimes(1);
    expect(h.reset).toHaveBeenCalledTimes(1);
  });

  test('regenerated audio is reported and closes the modal', () => {
    const h = renderModal();
    act(() => h.modal().handleAudioSaved('audio/kot-v2.mp3'));
    expect(h.onAudioUpdated).toHaveBeenCalledExactlyOnceWith('audio/kot-v2.mp3');
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.reset).toHaveBeenCalledTimes(1);
  });
});
