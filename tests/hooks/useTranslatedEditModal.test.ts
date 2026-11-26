import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTranslatedEditModal } from '../../src/hooks/useTranslatedEditModal';
import type { ModalSaveResult } from '../../src/hooks/useOptimisticModalSave';
import { translate } from '../../src/lib/translate';
import { withSnackbar } from './support/providers';

// translate() calls a Cloud Function.
vi.mock('../../src/lib/translate', () => ({ translate: vi.fn() }));

interface Fields {
  polish: string;
  english: string;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.mocked(translate).mockImplementation(async (text) => ({
    translatedText: `EN(${text})`,
    charsUsedToday: 0,
    resetTime: '',
  }));
  window.history.replaceState(null, '');
});

function renderModal(onSave: (data: Fields) => ModalSaveResult = () => undefined) {
  const values: Fields = { polish: '', english: '' };
  const form = {
    getValues: (name: keyof Fields) => values[name],
    setValue: (name: keyof Fields, value: string) => void (values[name] = value),
  };
  const onClose = vi.fn();
  const resetForm = vi.fn(() => Object.assign(values, { polish: '', english: '' }));
  const onAudioUpdated = vi.fn();
  const { wrapper, showSnackbar } = withSnackbar();
  const hook = renderHook(
    ({ open }) =>
      useTranslatedEditModal<Fields, Fields>({
        open,
        onClose,
        onSave,
        onAudioUpdated,
        form: form as never,
        resetForm,
      }),
    { wrapper, initialProps: { open: true } }
  );
  const modal = () => hook.result.current;
  return {
    ...hook,
    modal,
    values,
    onClose,
    resetForm,
    onAudioUpdated,
    showSnackbar,
    typePolish: (text: string) => {
      values.polish = text;
      act(() => modal().translation.handlePolishChange(text));
    },
    waitForTranslation: () => act(async () => vi.advanceTimersByTime(500)),
  };
}

describe('useTranslatedEditModal', () => {
  test('saving closes the modal, clears the form and drops a pending translation', async () => {
    const onSave = vi.fn(() => undefined);
    const h = renderModal(onSave);
    h.typePolish('kot');

    act(() => h.modal().save({ polish: 'kot', english: '' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ polish: 'kot', english: '' });
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.resetForm).toHaveBeenCalledTimes(1);

    await h.waitForTranslation();
    expect(translate).not.toHaveBeenCalled();
    expect(h.values.english).toBe('');
  });

  test('a rejected input keeps the modal open and its translation running', async () => {
    const h = renderModal(() => false);
    h.typePolish('kot');
    act(() => h.modal().save({ polish: 'kot', english: '' }));
    expect(h.onClose).not.toHaveBeenCalled();
    expect(h.resetForm).not.toHaveBeenCalled();

    await h.waitForTranslation();
    expect(h.values.english).toBe('EN(kot)');
  });

  test('pressing back closes the modal and clears the form', () => {
    const h = renderModal();
    expect(window.history.state?.backClose).toEqual(expect.any(String));

    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: null })));
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.resetForm).toHaveBeenCalledTimes(1);
  });

  test('closing the modal itself removes the history entry it added', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const h = renderModal();
    act(() => h.modal().handleClose());
    h.rerender({ open: false });
    expect(back).toHaveBeenCalledTimes(1);
    expect(h.resetForm).toHaveBeenCalledTimes(1);
  });

  test('regenerated audio is reported and closes the modal', () => {
    const h = renderModal();
    act(() => h.modal().handleAudioSaved('audio/kot-v2.mp3'));
    expect(h.onAudioUpdated).toHaveBeenCalledExactlyOnceWith('audio/kot-v2.mp3');
    expect(h.onClose).toHaveBeenCalledTimes(1);
    expect(h.resetForm).toHaveBeenCalledTimes(1);
  });
});
